import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { ProfileSwitcher } from '../core/profile/ProfileSwitcher'
import { RankingAttract } from '../games/exposure-shooter/ui/RankingScreen'
import type { PlayConfig } from '../games/exposure-shooter/playConfig'
import { ShooterRoot } from '../games/exposure-shooter/ui/ShooterRoot'

/**
 * 試作を友達に遊んでもらう間だけ：ブラウザ版は開いたらメニューを飛ばして、このステージをすぐ始める。
 * スマホは横向きになってから始まる。やめるとステージ選択に戻る。インストール版はふつうにタイトルから始まる。
 * ブラウザ版も普段の動きに戻すときは null にする。
 */
const QUICK_START: PlayConfig | null =
  import.meta.env.MODE === 'web' ? { mode: 'standard', difficulty: 'standard', region: 'chest_abdomen' } : null

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

/** タイトルで操作がないまま、この時間がたったらランキングを順に見せる（SPEC 10.1） */
const ATTRACT_AFTER_MS = 15000

/** シリーズ共通のゲーム選択（今は 1 作だけ） */
function TitleScreen({ onSelect }: { onSelect: (s: Screen) => void }) {
  const [attract, setAttract] = useState(false)
  useEffect(() => {
    let timer = setTimeout(() => setAttract(true), ATTRACT_AFTER_MS)
    const wake = () => {
      setAttract(false)
      clearTimeout(timer)
      timer = setTimeout(() => setAttract(true), ATTRACT_AFTER_MS)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, wake))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [])

  return (
    <div className="screen center title">
      <div className="title-profile">
        <ProfileSwitcher />
      </div>
      {attract && <RankingAttract />}
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
