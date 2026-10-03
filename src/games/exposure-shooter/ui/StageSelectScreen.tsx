import { standardKey, useBestStore } from '../bestStore'
import { DIFFICULTIES, type Difficulty } from '../logic/constants'
import { REGION_LABELS, REGIONS } from '../logic/master'
import { useMasterStore } from '../masterStore'
import type { PlayConfig } from '../playConfig'
import { tableKey } from '../logic/rankingRules'
import { useRankingStore } from '../rankingStore'

/** ステージ選択（SPEC 9）：region ごと。ベストスコアとクリア状況を出す */
export function StageSelectScreen({
  difficulty,
  onPlay,
  onBack,
}: {
  difficulty: Difficulty
  onPlay: (config: PlayConfig) => void
  onBack: () => void
}) {
  const conditions = useMasterStore((s) => s.conditions)
  const best = useBestStore((s) => s.records)
  const ranking = useRankingStore((s) => s.tables)

  return (
    <div className="screen select">
      <header className="screen-header">
        <button onClick={onBack}>← モード選択</button>
        <h1>ステージ選択</h1>
        <span className="muted">スタンダード／難易度 {DIFFICULTIES[difficulty].label}</span>
      </header>
      <div className="stage-grid">
        {REGIONS.map((region, i) => {
          const count = conditions.filter((c) => c.region === region).length
          const b = best[standardKey(difficulty, region)]
          // 1 位の名前とスコア（SPEC 10.1）
          const top = ranking[tableKey({ mode: 'standard', difficulty, region })]?.[0]
          return (
            <button
              key={region}
              className="stage-card"
              disabled={count === 0}
              onClick={() => onPlay({ mode: 'standard', difficulty, region })}
            >
              <span className="stage-no mono">STAGE {i + 1}</span>
              <span className="stage-title">{REGION_LABELS[region]}</span>
              <span className="muted small">{count > 0 ? `${count} 撮影` : 'マスタに撮影がありません'}</span>
              <span className="stage-best">
                {top || b ? (
                  <>
                    {top && (
                      <span className="mono">
                        1ST {top.score.toLocaleString()} <span className="muted">{top.name}</span>
                      </span>
                    )}
                    {b?.cleared && <span className="cleared">CLEAR</span>}
                  </>
                ) : (
                  <span className="muted small">未プレイ</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
