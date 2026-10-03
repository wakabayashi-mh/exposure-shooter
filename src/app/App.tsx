import { lazy, Suspense } from 'react'
import { create } from 'zustand'
import { MasterListScreen } from '../games/exposure-shooter/ui/MasterListScreen'

// Phaser は大きいので、プレイ画面を開いたときに読み込む
const PlayScreen = lazy(() =>
  import('../games/exposure-shooter/ui/PlayScreen').then((m) => ({ default: m.PlayScreen })),
)

type Screen = 'title' | 'master' | 'play'

const useAppStore = create<{ screen: Screen; go: (s: Screen) => void }>((set) => ({
  screen: 'title',
  go: (screen) => set({ screen }),
}))

export function App() {
  const { screen, go } = useAppStore()
  const back = () => go('title')

  switch (screen) {
    case 'master':
      return <MasterListScreen onBack={back} />
    case 'play':
      return (
        <Suspense fallback={<div className="screen center muted">読み込み中…</div>}>
          <PlayScreen onBack={back} />
        </Suspense>
      )
    default:
      return <TitleScreen onSelect={go} />
  }
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
          <button className="primary" onClick={() => onSelect('play')}>
            プレイ（試作）
          </button>
          <button onClick={() => onSelect('master')}>撮影条件マスタ</button>
        </div>
      </div>
    </div>
  )
}
