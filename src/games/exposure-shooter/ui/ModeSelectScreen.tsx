import { hardKey, useBestStore } from '../bestStore'
import { DIFFICULTIES, type Difficulty } from '../logic/constants'
import { missedIds } from '../logic/modes'
import { useMasterStore } from '../masterStore'
import type { PlayConfig } from '../playConfig'
import { usePlayStore } from '../playStore'

const DIFFICULTY_ORDER: Difficulty[] = ['beginner', 'standard', 'hard']

const DIFFICULTY_NOTES: Record<Difficulty, string> = {
  beginner: 'MISS でライフが減らない。スローが強い',
  standard: 'kV ±5・mAs ±1 段まで撃破',
  hard: 'kV ±2・mAs 完全一致。スローが弱い',
}

/** モード選択（SPEC 9）：スタンダード / ハード / 復習と、難易度 */
export function ModeSelectScreen({
  difficulty,
  onDifficulty,
  onStandard,
  onPlay,
  onMaster,
  onBack,
}: {
  difficulty: Difficulty
  onDifficulty: (d: Difficulty) => void
  onStandard: () => void
  onPlay: (config: PlayConfig) => void
  onMaster: () => void
  onBack: () => void
}) {
  const lastResult = usePlayStore((s) => s.lastResult)
  const hardBest = useBestStore((s) => s.records[hardKey(difficulty)])
  const masterCount = useMasterStore((s) => s.conditions.length)
  const missed = lastResult ? missedIds(lastResult.session.records) : []
  const reviewRegion = lastResult?.config.mode === 'standard' ? lastResult.config.region : undefined

  return (
    <div className="screen select">
      <header className="screen-header">
        <button onClick={onBack}>← タイトル</button>
        <h1>撮影条件シューティング</h1>
        <button className="push-right" onClick={onMaster}>
          撮影条件マスタ
        </button>
      </header>

      <div className="select-body">
        <section>
          <h2>難易度</h2>
          <div className="segmented">
            {DIFFICULTY_ORDER.map((d) => (
              <button key={d} className={d === difficulty ? 'on' : ''} onClick={() => onDifficulty(d)}>
                <span className="seg-label">{DIFFICULTIES[d].label}</span>
                <span className="seg-note">{DIFFICULTY_NOTES[d]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mode-cards">
          <button className="mode-card" onClick={onStandard} disabled={masterCount === 0}>
            <span className="mode-title">スタンダード</span>
            <span className="mode-desc">部位のグループごとのステージ。1 ステージ 2〜3 分。</span>
          </button>
          <button
            className="mode-card"
            onClick={() => onPlay({ mode: 'hard', difficulty })}
            disabled={masterCount === 0}
          >
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
      </div>
    </div>
  )
}
