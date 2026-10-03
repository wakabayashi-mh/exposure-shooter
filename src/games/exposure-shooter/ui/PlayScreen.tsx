import Phaser from 'phaser'
import { useEffect, useMemo, useRef, useState } from 'react'
import { KV_DIAL, MAS_INITIAL } from '../logic/constants'
import { kvOptions } from '../logic/params'
import { useMasterStore } from '../masterStore'
import { buildPool, modeLabel, stageName, type PlayConfig, type PlayResult } from '../playConfig'
import { usePlayStore } from '../playStore'
import { useSettingsStore } from '../settingsStore'
import { GameScene, type GameSceneData } from '../scenes/GameScene'
import { GAME_HEIGHT, GAME_WIDTH } from '../scenes/projection'
import { ControlPanel, TargetPanel, Toast, TopBar } from './Hud'

/** 終了の表示（CLEAR / GAME OVER）を見せてから結果画面へ移るまで [ms] */
const END_BANNER_MS = 1800

interface Props {
  config: PlayConfig
  onFinish: (result: PlayResult) => void
  onQuit: () => void
}

/**
 * プレイ画面。1280×800 の舞台を丸ごと拡大縮小し、Phaser と React の HUD を同じ座標で重ねる（SPEC 9.1）。
 * マウス・キーボードはここで受けて、ダイヤル操作は playStore、照準と曝射は GameScene に渡す。
 */
export function PlayScreen({ config, onFinish, onQuit }: Props) {
  const master = useMasterStore()
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const scale = useStageScale()
  const status = usePlayStore((s) => s.status)
  // 設定はプレイの開始時点の値を使う（プレイ中は変わらない）
  const [settings] = useState(() => useSettingsStore.getState().settings)

  const sceneData = useMemo<GameSceneData>(
    () => ({
      config,
      pool: buildPool(config, master.conditions),
      masSeries: master.mas.series,
      stageName: stageName(config),
      modeLabel: modeLabel(config),
      settings,
    }),
    [config, master.conditions, master.mas.series, settings],
  )

  // 終わったら少し見せてから結果画面へ
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  useEffect(() => {
    if (status !== 'cleared' && status !== 'gameover') return
    const id = setTimeout(() => {
      const result = usePlayStore.getState().lastResult
      if (result) onFinishRef.current(result)
    }, END_BANNER_MS)
    return () => clearTimeout(id)
  }, [status])

  // ダイヤルの選択肢（前回の値は保持する）
  useEffect(() => {
    usePlayStore.getState().setOptions(
      { kv: kvOptions(KV_DIAL.min, KV_DIAL.max, settings.kvStep), mas: master.mas.series, sid: master.sid.options },
      { kv: KV_DIAL.initial, mas: MAS_INITIAL, sid: master.sid.initial },
    )
  }, [master.mas.series, master.sid, settings.kvStep])

  // Phaser の起動と破棄
  useEffect(() => {
    if (master.status !== 'ready' || sceneData.pool.length === 0) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current!,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#0f1826',
      scale: { mode: Phaser.Scale.NONE },
      // 入力は React 側で受けて座標を渡す（HUD と座標系をそろえるため）
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      banner: false,
    })
    game.scene.add('game', GameScene, true, sceneData)
    gameRef.current = game
    return () => {
      gameRef.current = null
      // 破棄は次フレームで行われる（StrictMode の二重マウントでも 1 フレーム後に 1 つになる）
      game.destroy(true)
      usePlayStore.getState().setHud({ status: 'idle' })
    }
  }, [master.status, sceneData])

  const scene = () => gameRef.current?.scene.getScene('game') as GameScene | null | undefined

  // マウス・タッチ
  // マウス：ホバーでロックオン、左ボタン長押しで準備（画面のどこでも）。
  // タッチ（スマホ）：敵をタップしてロックオン、曝射パネルを長押しで準備 → 離して曝射。
  useEffect(() => {
    const stage = stageRef.current!
    const toBase = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
    }
    const onCanvas = (e: Event) => e.target instanceof HTMLCanvasElement
    let touchTrigger: number | null = null

    const onMove = (e: PointerEvent) => {
      // キャンバスの上にあるときだけ照準として扱う（パネルの上ではロックオンを変えない）
      if (e.pointerType === 'mouse') scene()?.setPointer(onCanvas(e) ? toBase(e) : null)
    }
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') scene()?.setPointer(null)
    }
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('button, .end-overlay')) return
      if (e.pointerType !== 'mouse') {
        if (onCanvas(e)) scene()?.tapAt(toBase(e))
        else if (el.closest('.trigger') && touchTrigger === null) {
          touchTrigger = e.pointerId
          scene()?.pressTrigger()
        }
        return
      }
      if (e.button === 0) scene()?.pressTrigger()
      if (e.button === 2 || (e.button === 1 && settings.middleButtonCycles)) {
        e.preventDefault()
        usePlayStore.getState().cycleSelected()
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) scene()?.releaseTrigger()
      } else if (e.pointerId === touchTrigger) {
        touchTrigger = null
        scene()?.releaseTrigger()
      }
    }
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.end-overlay')) return
      e.preventDefault()
      if (e.deltaY === 0) return
      const { step, selected } = usePlayStore.getState()
      step(selected, e.deltaY < 0 ? 1 : -1)
    }
    const onContext = (e: Event) => e.preventDefault()

    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerleave', onLeave)
    stage.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('contextmenu', onContext)
    return () => {
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      stage.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('contextmenu', onContext)
    }
  }, [scale, settings])

  // キーボード（補助操作）
  useEffect(() => {
    const k = settings.keys
    const dials: Record<string, ['kv' | 'mas' | 'sid', 1 | -1]> = {
      [k.kvUp]: ['kv', 1],
      [k.kvDown]: ['kv', -1],
      [k.masUp]: ['mas', 1],
      [k.masDown]: ['mas', -1],
      [k.sidUp]: ['sid', 1],
      [k.sidDown]: ['sid', -1],
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === k.nextTarget) {
        e.preventDefault()
        scene()?.cycleTarget()
      } else if (e.code === k.trigger) {
        e.preventDefault()
        if (!e.repeat) scene()?.pressTrigger()
      } else if (dials[e.code]) {
        const [key, dir] = dials[e.code]
        usePlayStore.getState().step(key, dir)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === k.trigger) scene()?.releaseTrigger()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [settings])


  return (
    <div className="play-viewport">
      <div
        ref={stageRef}
        className="play-stage"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT, transform: `scale(${scale})` }}
      >
        <div ref={hostRef} className="phaser-host" />
        {master.status === 'ready' && sceneData.pool.length === 0 && (
          <div className="end-overlay">
            <div className="end-card">
              <p>このステージの撮影がマスタにありません。</p>
              <button onClick={onQuit}>戻る</button>
            </div>
          </div>
        )}
        <TopBar />
        <TargetPanel />
        <ControlPanel />
        <Toast />
        <button className="hud-back" onClick={onQuit}>
          ← やめる
        </button>
        {(status === 'cleared' || status === 'gameover') && (
          <div className="end-overlay banner">
            <div className={`end-banner ${status}`}>{status === 'cleared' ? 'CLEAR' : 'GAME OVER'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/** ウィンドウに収まる倍率（基準 1280×800） */
function useStageScale() {
  const calc = () => Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT)
  const [scale, setScale] = useState(calc)
  useEffect(() => {
    const onResize = () => setScale(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}
