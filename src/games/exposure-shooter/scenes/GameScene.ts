import Phaser from 'phaser'
import { DIFFICULTIES, EXPOSURE, FEEDBACK, STAGE, type Difficulty } from '../logic/constants'
import { EXPOSURE_IDLE, prepProgress, press, release, tick, type ExposureState } from '../logic/exposure'
import { DEVIATION_LABELS, judge, resolveTolerance, type ExposureInput, type JudgeResult } from '../logic/judge'
import type { Condition } from '../logic/master'
import { applyBreach, applyShot, createSession, type SessionState } from '../logic/session'
import { pickEnemy, rollLowTarget } from '../logic/spawn'
import { usePlayStore } from '../playStore'
import { DEFENSE_Y, depthAt, drawFloor, GAME_HEIGHT, project, VP } from './projection'

export interface GameSceneData {
  pool: Condition[]
  masSeries: number[]
  difficulty: Difficulty
  stageName: string
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
  frame: Phaser.GameObjects.Graphics
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
  private uidSeq = 0
  private ended = false
  private lastHudKey = ''

  constructor() {
    super('game')
  }

  init(data: GameSceneData) {
    this.stage = data
    this.enemies = []
    this.locked = null
    this.exposure = EXPOSURE_IDLE
    this.session = createSession(DIFFICULTIES[data.difficulty].lives)
    this.realMs = 0
    this.nextSpawnIn = STAGE.firstSpawnSec
    this.lowSpawned = 0
    this.lowTarget = rollLowTarget(Math.random)
    this.ended = false
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

    const cfg = DIFFICULTIES[this.stage.difficulty]
    usePlayStore.getState().setHud({
      status: 'playing',
      stageName: this.stage.stageName,
      difficulty: this.stage.difficulty,
      lives: cfg.lives,
      maxLives: cfg.lives,
      score: 0,
      combo: 0,
      target: null,
      exposure: { phase: 'idle', progress: 0 },
      result: null,
    })
  }

  // ─── React から呼ばれる入力 ─────────────────────────────

  /** カーソル位置（基準解像度の座標）。キャンバスの外やパネルの上なら null */
  setPointer(p: { x: number; y: number } | null) {
    this.pointer = p
  }

  /** 左クリック / Space を押した：準備開始。ここでロックオン対象を固定する */
  pressTrigger() {
    if (this.ended || this.exposure.phase !== 'idle') return
    if (!this.locked) {
      usePlayStore.getState().showToast('敵にカーソルを重ねてロックオン')
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
    const cfg = DIFFICULTIES[this.stage.difficulty]
    this.realMs += delta

    // ロックオン中はスロー（敵の接近・出現・床の流れ）。曝射スイッチと制限時間は実時間
    const gameDt = (delta / 1000) * (this.locked ? cfg.slowFactor : 1)

    this.floorOffset = (this.floorOffset + gameDt * 1.6) % 1
    drawFloor(this.floor, this.floorOffset)

    this.nextSpawnIn -= gameDt
    if (this.nextSpawnIn <= 0 && this.enemies.length < cfg.maxEnemies) {
      this.spawn()
      this.nextSpawnIn = STAGE.spawnIntervalSec
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

    if (this.realMs >= STAGE.durationSec * 1000) {
      this.finish('cleared')
      return
    }
    this.pushHud()
  }

  // ─── 敵 ────────────────────────────────────────────────

  private spawn() {
    const elapsedRatio = this.realMs / (STAGE.durationSec * 1000)
    const cond = pickEnemy(
      this.stage.pool,
      {
        elapsedRatio,
        lowSpawned: this.lowSpawned,
        lowTarget: this.lowTarget,
        onField: this.enemies.map((e) => e.cond.id),
      },
      Math.random,
    )
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
      ...this.makePlaceholder(cond),
    }
    this.enemies.push(enemy)
    this.place(enemy)
  }

  /** キャラ SVG ができるまでの仮の見た目：部位名と方向を書いた札（SPEC 8.1） */
  private makePlaceholder(c: Condition) {
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
    const view_ = this.add.container(0, 0, [frame, part, view, pos])
    return { view: view_, frame }
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
    for (const e of this.enemies) paintPlaceholder(e.frame, e === this.locked)
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
    const cfg = DIFFICULTIES[this.stage.difficulty]
    const { params } = usePlayStore.getState()
    const input: ExposureInput = { ...params }
    const tol = resolveTolerance(target.cond, { kv: cfg.kvTol, masSteps: cfg.masTolSteps })
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
      cfg.missCostsLife,
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
    this.tweens.add({
      targets: e.view,
      scale: e.view.scale * 1.35,
      alpha: 0,
      duration: 320,
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

  private pushHud() {
    const timeLeftSec = Math.max(0, Math.ceil(STAGE.durationSec - this.realMs / 1000))
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
    const key = JSON.stringify([timeLeftSec, s.lives, s.score, s.combo, target?.condition.id, target?.remainingSec, target?.fixed, exposure])
    if (key === this.lastHudKey) return
    this.lastHudKey = key
    usePlayStore.getState().setHud({ timeLeftSec, lives: s.lives, score: s.score, combo: s.combo, target, exposure })
  }

  private finish(status: 'cleared' | 'gameover') {
    if (this.ended) return
    this.ended = true
    this.locked = null
    this.lockGfx.clear()
    this.pushHudFinal(status)
  }

  private pushHudFinal(status: 'cleared' | 'gameover') {
    const s = this.session
    usePlayStore.getState().setHud({
      status,
      lives: Math.max(0, s.lives),
      score: s.score,
      combo: s.combo,
      target: null,
      exposure: { phase: 'idle', progress: 0 },
      result: s,
    })
  }
}

function paintPlaceholder(g: Phaser.GameObjects.Graphics, locked: boolean) {
  g.clear()
  g.fillStyle(locked ? 0x22344f : 0x16233a, 1).fillRoundedRect(-ENEMY_W / 2, -ENEMY_H, ENEMY_W, ENEMY_H, 18)
  g.lineStyle(5, locked ? 0xf5c56a : 0x7f93a8, 1).strokeRoundedRect(-ENEMY_W / 2, -ENEMY_H, ENEMY_W, ENEMY_H, 18)
}
