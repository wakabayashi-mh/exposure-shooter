import { create } from 'zustand'
import { ShooterRoot } from '../games/exposure-shooter/ui/ShooterRoot'

type Screen = 'title' | 'exposure-shooter'

const useAppStore = create<{ screen: Screen; go: (s: Screen) => void }>((set) => ({
  screen: 'title',
  go: (screen) => set({ screen }),
}))

export function App() {
  const { screen, go } = useAppStore()
  if (screen === 'exposure-shooter') return <ShooterRoot onExit={() => go('title')} />
  return <TitleScreen onSelect={go} />
}

/** シリーズ共通のゲーム選択（今は 1 作だけ） */
function TitleScreen({ onSelect }: { onSelect: (s: Screen) => void }) {
  return (
    <div className="screen center title">
      <p className="series muted">放射線技師教育ゲームシリーズ</p>
      <div className="game-card">
        <h1>撮影条件シューティング</h1>
        <p className="muted">一般撮影の撮影条件（管電圧・mAs・撮影距離）を体で覚える</p>
        <div className="actions">
          <button className="primary" onClick={() => onSelect('exposure-shooter')}>
            あそぶ
          </button>
        </div>
      </div>
    </div>
  )
}
