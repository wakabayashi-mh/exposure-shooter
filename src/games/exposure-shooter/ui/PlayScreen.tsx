import Phaser from 'phaser'
import { useEffect, useRef } from 'react'
import { FloorScene, GAME_HEIGHT, GAME_WIDTH } from '../scenes/FloorScene'

/** Phaser を React 内にマウントする（SPEC 2）。アンマウント時に必ず破棄する */
export function PlayScreen({ onBack }: { onBack: () => void }) {
  const parent = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current!,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#0f1826',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [FloorScene],
      banner: false,
    })
    // 破棄は次フレームで行われる（StrictMode の二重マウントでも 1 フレーム後に 1 つになる）
    return () => game.destroy(true)
  }, [])

  return (
    <div className="screen play">
      <div ref={parent} className="phaser-host" />
      <button className="overlay-back" onClick={onBack}>
        ← 戻る
      </button>
    </div>
  )
}
