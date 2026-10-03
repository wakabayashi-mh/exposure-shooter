import { create } from 'zustand'
import type { PlayConfig } from '../games/exposure-shooter/playConfig'
import { ShooterRoot } from '../games/exposure-shooter/ui/ShooterRoot'

/**
 * 試作を友達に遊んでもらう間だけ：開いたらメニューを飛ばして、このステージをすぐ始める。
 * スマホは横向きになってから始まる。やめるとモード選択に戻る。普段の動きに戻すときは null にする。
 */
const QUICK_START: PlayConfig | null = { mode: 'standard', difficulty: 'standard', region: 'chest_abdomen' }

type Screen = 'title' | 'exposure-shooter'

const useAppStore = create<{ screen: Screen; go: (s: Screen) => void }>((set) => ({
  screen: QUICK_START ? 'exposure-shooter' : 'title',
  go: (screen) => set({ screen }),
}))

export function App() {
  const { screen, go } = useAppStore()
  if (screen === 'exposure-shooter') return <ShooterRoot onExit={() => go('title')} quickStart={QUICK_START} />
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
