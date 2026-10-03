import Phaser from 'phaser'
import { DIFFICULTIES, EXPOSURE, FEEDBACK, MODES, REVIEW_SPAWN_INTERVAL_SEC, STAGE } from '../logic/constants'
import { EXPOSURE_IDLE, prepProgress, press, release, tick, type ExposureState } from '../logic/exposure'
import { DEVIATION_LABELS, judge, resolveTolerance, type ExposureInput, type JudgeResult } from '../logic/judge'
import type { Condition } from '../logic/master'
import { applyBreach, applyShot, createSession, type SessionState } from '../logic/session'
import { hardSpawnIntervalSec, pickHardEnemy, toleranceFor } from '../logic/modes'
import { pickEnemy, rollLowTarget } from '../logic/spawn'
import type { PlayConfig } from '../playConfig'
import { FACES, hasCharacter, loadCharacterImage, textureKey, type Face } from '../characters'
import { usePlayStore } from '../playStore'
import { DEFENSE_Y, depthAt, drawFloor, GAME_HEIGHT, project, VP } from './projection'

export interface GameSceneData {
  config: PlayConfig
  /** 出現させる敵の候補。復習モードではこの順に 1 体ずつ出す */
  pool: Condition[]
  masSeries: number[]
  stageName: string
  modeLabel: string
}

/** キャラの大きさ（z = 1 のとき）。足元が原点 */
const ENEMY_W = 150
const ENEMY_H = 200
/** レーンの候補（同時に出る敵が重ならないように空いているレーンを使う） */
const LANES = [-1.1, 0, 1.1, -0.55, 0.55]

const FONT = '"Yu Gothic UI", "Meiryo", sans-serif'

interface Enemy {
  uid: number
  cond: Condition
  lane: number
  /** 出現からのゲーム内時間 [秒] */
  t: number
  /** 出現時刻（実時間 ms） */
  spawnedAt: number
  view: Phaser.GameObjects.Container
  /** キャラ SVG があればその画像、なければ部位名を書いた札（SPEC 8.1） */
  look: { kind: 'character'; sprite: Phaser.GameObjects.Image } | { kind: 'placeholder'; frame: Phaser.GameObjects.Graphics }
  face: Face
}

/**
 * プレイ画面のゲーム本体（SPEC 7）。
 * 判定・得点・曝射スイッチは logic/ の純粋関数に任せ、ここは時間・描画・入力の配線だけを持つ。
 * 入力は React（PlayScreen）から pointer / pressTrigger などのメソッドで受け取る。
 */
export class GameScene extends Phaser.Scene {
  private stage!: GameSceneData
  private floor!: Phaser.GameObjects.Graphics
  private lockGfx!: Phaser.GameObjects.Graphics
  private flash!: Phaser.GameObjects.Rectangle

  private enemies: Enemy[] = []
  private locked: Enemy | null = null
  private pointer: { x: number; y: number } | null = null
  private exposure: ExposureState = EXPOSURE_IDLE
  private session!: SessionState

  /** 実時間の経過 [ms] */
  private realMs = 0
  private floorOffset = 0
  private nextSpawnIn = 0
  private lowSpawned = 0
  private lowTarget = 1
  /** 復習モードでまだ出していない敵 */
  private reviewQueue: Condition[] = []
  private uidSeq = 0
  private ended = false
  /** キャラ画像のテクスチャを作り終えたか（終わるまで敵を出さない） */
  private charactersReady = false
  private lastHudKey = ''

  constructor() {
    super('game')
  }

  init(data: GameSceneData) {
    this.stage = data
    this.enemies = []
    this.locked = null
    this.exposure = EXPOSURE_IDLE
    this.session = createSession(DIFFICULTIES[data.config.difficulty].lives)
    this.realMs = 0
    this.nextSpawnIn = STAGE.firstSpawnSec
    this.lowSpawned = 0
    this.lowTarget = rollLowTarget(Math.random)
    this.reviewQueue = [...data.pool]
    this.ended = false
    this.charactersReady = false
    this.lastHudKey = ''
  }

  create() {
    this.floor = this.add.graphics().setDepth(-10)
    this.lockGfx = this.add.graphics().setDepth(500)
    this.flash = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff)
      .setOrigin(0)
      .setDepth(1000)
      .setAlpha(0)
    void this.loadCharacters()

    const cfg = DIFFICULTIES[this.stage.config.difficulty]
    usePlayStore.getState().setHud({
      status: 'playing',
      stageName: this.stage.stageName,
      modeLabel: this.stage.modeLabel,
      lives: cfg.lives,
      maxLives: cfg.lives,
      score: 0,
      combo: 0,
      target: null,
      exposure: { phase: 'idle', progress: 0 },
    })
  }

  /** このプレイに出るキャラの 3 表情をテクスチャにする。読めなかったキャラはプレースホルダーで出す */
  private async loadCharacters() {
    const ids = [...new Set(this.stage.pool.map((c) => c.character))].filter(hasCharacter)
    await Promise.all(
      ids.flatMap((id) =>
        FACES.map(async (face) => {
          try {
            const img = await loadCharacterImage(id, face)
            const key = textureKey(id, face)
            // 読み込み中にシーンが終わっていたら何もしない
            if (img && this.sys.textures && !this.textures.exists(key)) this.textures.addImage(key, img)
          } catch (e) {
            console.warn(e)
          }
        }),
      ),
    )
    this.charactersReady = true
  }

  // ─── React から呼ばれる入力 ─────────────────────────────

  /** カーソル位置（基準解像度の座標）。キャンバスの外やパネルの上なら null */
  setPointer(p: { x: number; y: number } | null) {
    this.pointer = p
  }

  /** タッチ：タップした位置の敵にロックオンする（タップでは照準位置を残さない） */
  tapAt(p: { x: number; y: number }) {
    if (this.ended || this.exposure.phase !== 'idle') return
    // 指より小さい敵も狙えるように、当たり判定を少し広げる
    const hit = [...this.enemies]
      .sort((a, b) => b.t - a.t)
      .find((e) => Phaser.Geom.Rectangle.Inflate(this.bounds(e), 24, 24).contains(p.x, p.y))
    if (hit) this.locked = hit
  }

  /** 左クリック / Space を押した：準備開始。ここでロックオン対象を固定する */
  pressTrigger() {
    if (this.ended || this.exposure.phase !== 'idle') return
    if (!this.locked) {
      usePlayStore.getState().showToast('先に敵をロックオンしてください')
      return
    }
    this.exposure = press(this.exposure)
  }

  /** 左クリック / Space を離した：準備完了なら曝射 */
  releaseTrigger() {
    if (this.ended) return
    const { event } = release(this.exposure)
    this.exposure = EXPOSURE_IDLE
    if (event === 'cancel') usePlayStore.getState().showToast('準備未完了')
    if (event === 'expose') this.fire()
  }

  /** Tab：近い順に次の敵へロックオンを切り替える */
  cycleTarget() {
    if (this.ended || this.exposure.phase !== 'idle' || this.enemies.length === 0) return
    const byNear = [...this.enemies].sort((a, b) => b.t - a.t)
    const i = this.locked ? byNear.indexOf(this.locked) : -1
    this.locked = byNear[(i + 1) % byNear.length]
  }

  // ─── 毎フレーム ─────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.ended) return
    const cfg = DIFFICULTIES[this.stage.config.difficulty]
    const mode = this.stage.config.mode
    this.realMs += delta

    // ロックオン中はスロー（敵の接近・出現・床の流れ）。曝射スイッチと制限時間は実時間
    const gameDt = (delta / 1000) * (this.locked ? cfg.slowFactor : 1)

    this.floorOffset = (this.floorOffset + gameDt * 1.6) % 1
    drawFloor(this.floor, this.floorOffset)

    this.nextSpawnIn -= gameDt
    if (this.charactersReady && this.nextSpawnIn <= 0 && this.enemies.length < MODES[mode].maxEnemies) {
      this.spawn()
      this.nextSpawnIn =
        mode === 'hard'
          ? hardSpawnIntervalSec(this.realMs / 1000)
          : mode === 'review'
            ? REVIEW_SPAWN_INTERVAL_SEC
            : STAGE.spawnIntervalSec
    }

    for (const e of [...this.enemies]) {
      e.t += gameDt
      if (e.t >= STAGE.approachSec) this.breach(e)
      else this.place(e)
    }
    if (this.ended) return

    this.updateHover()

    const prevPhase = this.exposure.phase
    const r = tick(this.exposure, delta, EXPOSURE)
    this.exposure = r.state
    if (r.event === 'overheat') usePlayStore.getState().showToast('管球負荷：準備を解除しました')
    if (prevPhase !== 'idle' && !this.locked) {
      // 準備中に対象が防衛ラインを越えた
      this.exposure = EXPOSURE_IDLE
    }

    this.drawLock()

    // 終わり方：スタンダードは制限時間、復習は全員を片付けたとき、ハードはライフが尽きるまで
    const done =
      (mode === 'standard' && this.realMs >= STAGE.durationSec * 1000) ||
      (mode === 'review' && this.reviewQueue.length === 0 && this.enemies.length === 0)
    if (done) {
      this.finish('cleared')
      return
    }
    this.pushHud()
  }

  // ─── 敵 ────────────────────────────────────────────────

  private pickNext(): Condition | undefined {
    const onField = this.enemies.map((e) => e.cond.id)
    switch (this.stage.config.mode) {
      case 'standard':
        return pickEnemy(
          this.stage.pool,
          {
            elapsedRatio: this.realMs / (STAGE.durationSec * 1000),
            lowSpawned: this.lowSpawned,
            lowTarget: this.lowTarget,
            onField,
          },
          Math.random,
        )
      case 'hard':
        return pickHardEnemy(this.stage.pool, this.realMs / 1000, onField, Math.random)
      case 'review':
        return this.reviewQueue.shift()
    }
  }

  private spawn() {
    const cond = this.pickNext()
    if (!cond) return
    if (cond.frequency === 'low') this.lowSpawned++

    const used = new Set(this.enemies.map((e) => e.lane))
    const lanes = LANES.filter((l) => !used.has(l))
    const lane = lanes[Math.floor(Math.random() * Math.min(3, lanes.length))] ?? 0

    const enemy: Enemy = {
      uid: ++this.uidSeq,
      cond,
      lane,
      t: 0,
      spawnedAt: this.realMs,
      face: 'approach',
      ...this.makeLook(cond),
    }
    this.enemies.push(enemy)
    this.place(enemy)
  }

  private makeLook(c: Condition): Pick<Enemy, 'view' | 'look'> {
    const key = textureKey(c.character, 'approach')
    if (!this.textures.exists(key)) return this.makePlaceholder(c)
    const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1).setDisplaySize(ENEMY_W, ENEMY_H)
    // 部位名・方向は全難易度で出す（SPEC 7.2）
    const label = this.add
      .text(0, -ENEMY_H - 6, `${c.part} ${c.view}`, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#e8eef4',
        fontStyle: 'bold',
        stroke: '#0f1826',
        strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
    return { view: this.add.container(0, 0, [sprite, label]), look: { kind: 'character', sprite } }
  }

  /** 表情を切り替える（プレースホルダーは枠の色で表す） */
  private setFace(e: Enemy, face: Face) {
    if (e.face === face) return
    e.face = face
    if (e.look.kind === 'character') e.look.sprite.setTexture(textureKey(e.cond.character, face)).setDisplaySize(ENEMY_W, ENEMY_H)
    else paintPlaceholder(e.look.frame, face !== 'approach')
  }

  /** キャラ SVG がない撮影の仮の見た目：部位名と方向を書いた札（SPEC 8.1） */
  private makePlaceholder(c: Condition): Pick<Enemy, 'view' | 'look'> {
    const frame = this.add.graphics()
    paintPlaceholder(frame, false)
    const part = this.add
      .text(0, -ENEMY_H + 46, c.part, { fontFamily: FONT, fontSize: '30px', color: '#e8eef4', fontStyle: 'bold' })
      .setOrigin(0.5)
    const view = this.add
      .text(0, -ENEMY_H + 92, c.view, { fontFamily: FONT, fontSize: '22px', color: '#e8eef4', align: 'center', wordWrap: { width: ENEMY_W - 16 } })
      .setOrigin(0.5, 0)
    const pos = this.add
      .text(0, -30, c.position ?? '', { fontFamily: FONT, fontSize: '18px', color: '#7f93a8' })
      .setOrigin(0.5)
    return { view: this.add.container(0, 0, [frame, part, view, pos]), look: { kind: 'placeholder', frame } }
  }

  private progressOf(e: Enemy) {
    return Math.min(1, e.t / STAGE.approachSec)
  }

  private place(e: Enemy) {
    const p = project(e.lane, depthAt(this.progressOf(e)))
    e.view.setPosition(p.x, p.y).setScale(p.scale).setDepth(p.scale * 100)
  }

  private bounds(e: Enemy) {
    const s = e.view.scale
    return new Phaser.Geom.Rectangle(e.view.x - (ENEMY_W / 2) * s, e.view.y - ENEMY_H * s, ENEMY_W * s, ENEMY_H * s)
  }

  /** ホバーでロックオン。準備中は固定。敵のいない所に移っても解除しない（SPEC 7.2・7.3） */
  private updateHover() {
    if (!this.pointer || this.exposure.phase !== 'idle') return
    const { x, y } = this.pointer
    const hit = [...this.enemies]
      .sort((a, b) => b.t - a.t)
      .find((e) => this.bounds(e).contains(x, y))
    if (hit && hit !== this.locked) this.locked = hit
  }

  private drawLock() {
    const g = this.lockGfx
    g.clear()
    for (const e of this.enemies) this.setFace(e, e === this.locked ? 'lockon' : 'approach')
    if (!this.locked) return
    const b = this.bounds(this.locked)
    const pad = 8
    const len = Math.max(12, Math.min(b.width, b.height) * 0.25)
    const fixed = this.exposure.phase !== 'idle'
    g.lineStyle(4, fixed ? 0xc96b7b : 0xf5c56a, 1)
    const x0 = b.x - pad, y0 = b.y - pad, x1 = b.right + pad, y1 = b.bottom + pad
    for (const [cx, cy, dx, dy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ]) {
      g.lineBetween(cx, cy, cx + dx * len, cy)
      g.lineBetween(cx, cy, cx, cy + dy * len)
    }
  }

  private removeEnemy(e: Enemy) {
    this.enemies = this.enemies.filter((x) => x !== e)
    if (this.locked === e) this.locked = null
  }

  private breach(e: Enemy) {
    this.removeEnemy(e)
    this.session = applyBreach(this.session, e.cond.id, this.realMs - e.spawnedAt)
    this.tweens.add({ targets: e.view, alpha: 0, y: e.view.y + 30, duration: 300, onComplete: () => e.view.destroy() })
    this.cameras.main.shake(180, 0.006)
    usePlayStore.getState().showToast(`${e.cond.part} ${e.cond.view} が防衛ラインに到達`)
    if (this.session.lives <= 0) this.finish('gameover')
  }

  // ─── 曝射 ──────────────────────────────────────────────

  private fire() {
    const target = this.locked
    if (!target) return
    const { mode, difficulty } = this.stage.config
    const { params } = usePlayStore.getState()
    const input: ExposureInput = { ...params }
    const tol = resolveTolerance(target.cond, toleranceFor(mode, difficulty))
    const result = judge(target.cond, input, tol, this.stage.masSeries)

    const before = this.session.score
    this.session = applyShot(
      this.session,
      {
        conditionId: target.cond.id,
        judge: result,
        input,
        remainingRatio: 1 - this.progressOf(target),
        elapsedMs: this.realMs - target.spawnedAt,
      },
      DIFFICULTIES[difficulty].missCostsLife,
    )
    this.removeEnemy(target)
    this.playBeam(target)

    if (result.result === 'MISS') {
      this.playMiss(target, input, result)
    } else {
      this.playDefeat(target, result.result, this.session.score - before)
    }
    if (this.session.lives <= 0) this.finish('gameover')
  }

  private playBeam(target: Enemy) {
    const b = this.bounds(target)
    const beam = this.add.graphics().setDepth(900)
    beam.lineStyle(10, 0xe8eef4, 0.9)
    beam.lineBetween(VP.x, GAME_HEIGHT, b.centerX, b.centerY)
    this.tweens.add({ targets: beam, alpha: 0, duration: 250, onComplete: () => beam.destroy() })
    this.flash.setAlpha(0.55)
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 220 })
  }

  private playDefeat(e: Enemy, label: 'PERFECT' | 'GOOD', points: number) {
    // 撃破の表情を少し見せてから消える
    this.setFace(e, 'defeated')
    this.tweens.add({
      targets: e.view,
      scale: e.view.scale * 1.25,
      alpha: 0,
      delay: 260,
      duration: 420,
      ease: 'Quad.easeIn',
      onComplete: () => e.view.destroy(),
    })
    const color = label === 'PERFECT' ? '#f5c56a' : '#e8eef4'
    const b = this.bounds(e)
    const text = this.add
      .text(b.centerX, b.y, `${label}  +${points}`, { fontFamily: FONT, fontSize: '30px', color, fontStyle: 'bold', stroke: '#0f1826', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(950)
    this.tweens.add({ targets: text, y: b.y - 60, alpha: 0, duration: 900, onComplete: () => text.destroy() })
  }

  /** MISS：敵は消え、その場で「あなたの条件」と「正解条件」を並べた吹き出しを出す（SPEC 7.5） */
  private playMiss(e: Enemy, input: ExposureInput, result: JudgeResult) {
    this.cameras.main.shake(120, 0.004)
    this.tweens.add({
      targets: e.view,
      alpha: 0,
      angle: 12,
      y: e.view.y + 20,
      duration: 400,
      onComplete: () => e.view.destroy(),
    })

    const c = e.cond
    const fmt = (v: ExposureInput) => `${v.kv} kV ／ ${v.mas} mAs ／ ${v.sid} cm`
    const lines: { text: string; color: string; size: number; bold?: boolean }[] = [
      { text: `MISS　${c.part} ${c.view}`, color: '#c96b7b', size: 22, bold: true },
      { text: `あなた　${fmt(input)}`, color: '#e8eef4', size: 18 },
      { text: `正　解　${fmt(c)}`, color: '#f5c56a', size: 18, bold: true },
      ...result.deviations.map((d) => ({ text: `・${DEVIATION_LABELS[d]}`, color: '#e8eef4', size: 16 })),
      ...(c.tip ? [{ text: c.tip, color: '#7f93a8', size: 14 }] : []),
    ]

    const W = 400
    const pad = 14
    const bubble = this.add.container(0, 0).setDepth(960)
    let y = pad
    for (const l of lines) {
      const t = this.add.text(pad, y, l.text, {
        fontFamily: FONT,
        fontSize: `${l.size}px`,
        color: l.color,
        fontStyle: l.bold ? 'bold' : 'normal',
        wordWrap: { width: W - pad * 2, useAdvancedWrap: true },
      })
      bubble.add(t)
      y += t.height + 4
    }
    const H = y + pad - 4
    const bg = this.add.graphics()
    bg.fillStyle(0x0f1826, 0.95).fillRoundedRect(0, 0, W, H, 10)
    bg.lineStyle(2, 0xc96b7b, 1).strokeRoundedRect(0, 0, W, H, 10)
    bubble.addAt(bg, 0)

    const b = this.bounds(e)
    const bx = Phaser.Math.Clamp(b.centerX - W / 2, 10, 970 - W)
    const by = Phaser.Math.Clamp(b.y - H - 12, 56, DEFENSE_Y - H - 4)
    bubble.setPosition(bx, by)
    this.time.delayedCall(FEEDBACK.missBubbleMs, () =>
      this.tweens.add({ targets: bubble, alpha: 0, duration: 250, onComplete: () => bubble.destroy() }),
    )
  }

  // ─── HUD と終了 ─────────────────────────────────────────

  /** 上段の時計（スタンダード: 残り時間、ハード: 経過時間、復習: 残りの敵の数） */
  private clock(): { label: string; warn: boolean } {
    const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    switch (this.stage.config.mode) {
      case 'standard': {
        const left = Math.max(0, Math.ceil(STAGE.durationSec - this.realMs / 1000))
        return { label: mmss(left), warn: left <= 10 }
      }
      case 'hard':
        return { label: `経過 ${mmss(Math.floor(this.realMs / 1000))}`, warn: false }
      case 'review':
        return { label: `残り ${this.reviewQueue.length + this.enemies.length} 体`, warn: false }
    }
  }

  private pushHud() {
    const clock = this.clock()
    const target = this.locked
      ? {
          condition: this.locked.cond,
          remainingSec: Math.max(0, Math.round((STAGE.approachSec - this.locked.t) * 10) / 10),
          fixed: this.exposure.phase !== 'idle',
        }
      : null
    const exposure = { phase: this.exposure.phase, progress: prepProgress(this.exposure, EXPOSURE) }
    const s = this.session
    // 変化があったときだけ React に流す
    const key = JSON.stringify([clock, s.lives, s.score, s.combo, target?.condition.id, target?.remainingSec, target?.fixed, exposure])
    if (key === this.lastHudKey) return
    this.lastHudKey = key
    usePlayStore.getState().setHud({ clock, lives: s.lives, score: s.score, combo: s.combo, target, exposure })
  }

  private finish(status: 'cleared' | 'gameover') {
    if (this.ended) return
    this.ended = true
    this.locked = null
    this.lockGfx.clear()
    const s = this.session
    usePlayStore.getState().setHud({
      status,
      clock: this.clock(),
      lives: Math.max(0, s.lives),
      score: s.score,
      combo: s.combo,
      target: null,
      exposure: { phase: 'idle', progress: 0 },
      lastResult: {
        config: this.stage.config,
        status,
        session: s,
        elapsedSec: this.realMs / 1000,
        conditions: this.stage.pool,
      },
    })
  }
}

function paintPlaceholder(g: Phaser.GameObjects.Graphics, locked: boolean) {
  g.clear()
  g.fillStyle(locked ? 0x22344f : 0x16233a, 1).fillRoundedRect(-ENEMY_W / 2, -ENEMY_H, ENEMY_W, ENEMY_H, 18)
  g.lineStyle(5, locked ? 0xf5c56a : 0x7f93a8, 1).strokeRoundedRect(-ENEMY_W / 2, -ENEMY_H, ENEMY_W, ENEMY_H, 18)
}
