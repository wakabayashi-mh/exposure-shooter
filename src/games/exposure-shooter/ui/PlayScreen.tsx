import Phaser from 'phaser'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CONTROLS, DIFFICULTIES, KV_DIAL, MAS_INITIAL, type Difficulty } from '../logic/constants'
import { REGION_LABELS, type Region } from '../logic/master'
import { kvOptions } from '../logic/params'
import { stagePool } from '../logic/spawn'
import { useMasterStore } from '../masterStore'
import { usePlayStore } from '../playStore'
import { GameScene, type GameSceneData } from '../scenes/GameScene'
import { GAME_HEIGHT, GAME_WIDTH } from '../scenes/projection'
import { ControlPanel, TargetPanel, Toast, TopBar } from './Hud'
import { StageEndOverlay } from './StageEndOverlay'

interface Props {
  onBack: () => void
  region?: Region
  difficulty?: Difficulty
}

/**
 * プレイ画面。1280×800 の舞台を丸ごと拡大縮小し、Phaser と React の HUD を同じ座標で重ねる（SPEC 9.1）。
 * マウス・キーボードはここで受けて、ダイヤル操作は playStore、照準と曝射は GameScene に渡す。
 */
export function PlayScreen({ onBack, region = 'chest_abdomen', difficulty = 'standard' }: Props) {
  const master = useMasterStore()
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const scale = useStageScale()
  const status = usePlayStore((s) => s.status)

  const sceneData = useMemo<GameSceneData>(
    () => ({
      pool: stagePool(master.conditions, region),
      masSeries: master.mas.series,
      difficulty,
      stageName: `${REGION_LABELS[region]}`,
    }),
    [master.conditions, master.mas.series, region, difficulty],
  )

  // ダイヤルの選択肢（前回の値は保持する）
  useEffect(() => {
    usePlayStore.getState().setOptions(
      { kv: kvOptions(KV_DIAL.min, KV_DIAL.max, KV_DIAL.step), mas: master.mas.series, sid: master.sid.options },
      { kv: KV_DIAL.initial, mas: MAS_INITIAL, sid: master.sid.initial },
    )
  }, [master.mas.series, master.sid])

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

  // マウス
  useEffect(() => {
    const stage = stageRef.current!
    const toBase = (e: MouseEvent) => {
      const r = stage.getBoundingClientRect()
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
    }
    const onMove = (e: MouseEvent) => {
      // キャンバスの上にあるときだけ照準として扱う（パネルの上ではロックオンを変えない）
      scene()?.setPointer(e.target instanceof HTMLCanvasElement ? toBase(e) : null)
    }
    const onLeave = () => scene()?.setPointer(null)
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, .end-overlay')) return
      if (e.button === 0) scene()?.pressTrigger()
      if (e.button === 2 || (e.button === 1 && CONTROLS.middleButtonCycles)) {
        e.preventDefault()
        usePlayStore.getState().cycleSelected()
      }
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) scene()?.releaseTrigger()
    }
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.end-overlay')) return
      e.preventDefault()
      if (e.deltaY === 0) return
      const { step, selected } = usePlayStore.getState()
      step(selected, e.deltaY < 0 ? 1 : -1)
    }
    const onContext = (e: MouseEvent) => e.preventDefault()

    stage.addEventListener('mousemove', onMove)
    stage.addEventListener('mouseleave', onLeave)
    stage.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('contextmenu', onContext)
    return () => {
      stage.removeEventListener('mousemove', onMove)
      stage.removeEventListener('mouseleave', onLeave)
      stage.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('contextmenu', onContext)
    }
  }, [scale])

  // キーボード（補助操作）
  useEffect(() => {
    const k = CONTROLS.keys
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
  }, [])

  const retry = () => scene()?.scene.restart(sceneData)

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
              <button onClick={onBack}>戻る</button>
            </div>
          </div>
        )}
        <TopBar modeLabel={`スタンダードモード／難易度 ${DIFFICULTIES[difficulty].label}`} />
        <TargetPanel />
        <ControlPanel />
        <Toast />
        <button className="hud-back" onClick={onBack}>
          ← やめる
        </button>
        {(status === 'cleared' || status === 'gameover') && (
          <StageEndOverlay pool={sceneData.pool} onRetry={retry} onBack={onBack} />
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
