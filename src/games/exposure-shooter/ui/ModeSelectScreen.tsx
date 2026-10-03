import { ProfileSwitcher } from '../../../core/profile/ProfileSwitcher'
import { hardKey, useBestStore } from '../bestStore'
import { DIFFICULTIES, type Difficulty } from '../logic/constants'
import { missedIds } from '../logic/modes'
import { useMasterStore } from '../masterStore'
import type { PlayConfig } from '../playConfig'
import { usePlayStore } from '../playStore'
import { useSettingsStore } from '../settingsStore'

const DIFFICULTY_ORDER: Difficulty[] = ['beginner', 'standard', 'hard']

/** モード選択から開ける画面 */
type MenuScreen = 'ranking' | 'history' | 'dex' | 'master' | 'settings'

const MENU: { screen: MenuScreen; label: string }[] = [
  { screen: 'ranking', label: 'ハイスコア' },
  { screen: 'history', label: '学習履歴' },
  { screen: 'dex', label: 'キャラ図鑑' },
  { screen: 'master', label: '撮影条件マスタ' },
  { screen: 'settings', label: '設定' },
]

/** モード選択（SPEC 9）：スタンダード / ハード / 復習と、難易度 */
export function ModeSelectScreen({
  difficulty,
  onDifficulty,
  onStandard,
  onPlay,
  onNavigate,
  onBack,
}: {
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  onStandard: () => void
  onPlay: (config: PlayConfig) => void
  onNavigate: (screen: MenuScreen) => void
  onBack: () => void
}) {
  const lastResult = usePlayStore((s) => s.lastResult)
  const hardBest = useBestStore((s) => s.records[hardKey(difficulty)])
  const masterCount = useMasterStore((s) => s.conditions.length)
  const settings = useSettingsStore((s) => s.settings)
  const missed = lastResult ? missedIds(lastResult.session.records) : []
  const reviewRegion = lastResult?.config.mode === 'standard' ? lastResult.config.region : undefined

  // 難易度の説明は設定画面の値から作る
  const note = (d: Difficulty) => {
    const t = settings.tolerance[d]
    const tol = `kV ±${t.kvTol}・mAs ${t.masTolSteps === 0 ? '完全一致' : `±${t.masTolSteps} 段`}`
    return d === 'beginner' ? `${tol}。MISS でライフが減らない` : `${tol}。スロー ×${settings.slowFactor[d].toFixed(2)}`
  }

  return (
    <div className="screen select">
      <header className="screen-header">
        <button onClick={onBack}>← タイトル</button>
        <h1>撮影条件シューティング</h1>
        <div className="push-right">
          <ProfileSwitcher />
        </div>
      </header>

      <div className="select-body">
        <section>
          <h2>難易度</h2>
          <div className="segmented">
            {DIFFICULTY_ORDER.map((d) => (
              <button key={d} className={d === difficulty ? 'on' : ''} onClick={() => onDifficulty(d)}>
                <span className="seg-label">{DIFFICULTIES[d].label}</span>
                <span className="seg-note">{note(d)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mode-cards">
          <button className="mode-card" onClick={onStandard} disabled={masterCount === 0}>
            <span className="mode-title">スタンダード</span>
            <span className="mode-desc">部位のグループごとのステージ。1 ステージ 2〜3 分。</span>
          </button>
          <button className="mode-card" onClick={() => onPlay({ mode: 'hard', difficulty })} disabled={masterCount === 0}>
            <span className="mode-title">ハード（無制限）</span>
            <span className="mode-desc">全部位がランダムに出る。ライフが尽きるまで。許容値は常にハード。</span>
            {hardBest && (
              <span className="mode-best mono">
                ベスト {hardBest.kills} 体 ／ {Math.floor(hardBest.timeSec / 60)}:{String(hardBest.timeSec % 60).padStart(2, '0')}
              </span>
            )}
          </button>
          <button
            className="mode-card"
            onClick={() => onPlay({ mode: 'review', difficulty, ids: missed, region: reviewRegion })}
            disabled={missed.length === 0}
          >
            <span className="mode-title">復習</span>
            <span className="mode-desc">
              {missed.length > 0 ? `直前のプレイで外した ${missed.length} 部位だけを出す。` : '直前のプレイで外した部位はありません。'}
            </span>
          </button>
        </section>

        <nav className="menu-row" aria-label="そのほかの画面">
          {MENU.map((m) => (
            <button key={m.screen} onClick={() => onNavigate(m.screen)}>
              {m.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
