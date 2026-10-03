import type { Mode } from '../logic/constants'
import { DEVIATION_LABELS } from '../logic/judge'
import { missedIds, rankFor } from '../logic/modes'
import { stageName, type PlayConfig } from '../playConfig'
import { usePlayStore } from '../playStore'

/** 結果・復習画面（SPEC 9.2） */
export function ResultScreen({
  newBest,
  onPlay,
  onStageSelect,
}: {
  newBest: boolean
  onPlay: (config: PlayConfig) => void
  onStageSelect: (mode: Mode) => void
}) {
  const result = usePlayStore((s) => s.lastResult)
  if (!result) return null
  const { config, session, status } = result
  const byId = new Map(result.conditions.map((c) => [c.id, c]))
  const count = (r: string) => session.records.filter((x) => x.result === r).length
  const kills = count('PERFECT') + count('GOOD')
  const review = session.records.filter((r) => r.result === 'MISS' || r.result === 'BREACH')
  const missed = missedIds(session.records)
  const hard = config.mode === 'hard'
  const rank = rankFor(session, status === 'cleared')
  const sec = Math.floor(result.elapsedSec)

  const retryMissed = () =>
    onPlay({
      mode: 'review',
      difficulty: config.difficulty,
      ids: missed,
      region: config.mode === 'hard' ? undefined : config.region,
    })

  return (
    <div className="screen result">
      <div className="result-head">
        <div>
          <div className="muted">{hard ? 'ハード（無制限）' : config.mode === 'review' ? '復習' : 'スタンダード'}</div>
          <h1>{stageName(config)}</h1>
          <div className={`result-status ${status}`}>{status === 'cleared' ? 'CLEAR' : 'GAME OVER'}</div>
        </div>
        {!hard && <div className={`rank rank-${rank}`}>{rank}</div>}
        {newBest && <div className="new-best">ベスト更新</div>}
      </div>

      <div className="result-stats">
        {hard ? (
          <>
            <Stat label="撃破数" value={`${kills}`} />
            <Stat label="到達時間" value={`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`} />
            <Stat label="最高コンボ" value={`${session.maxCombo}`} />
            <Stat label="スコア" value={session.score.toLocaleString()} />
          </>
        ) : (
          <>
            <Stat label="スコア" value={session.score.toLocaleString()} />
            <Stat label="撃破数" value={`${kills} / ${session.records.length}`} sub={`PERFECT ${count('PERFECT')}・GOOD ${count('GOOD')}`} />
            <Stat label="最高コンボ" value={`${session.maxCombo}`} />
          </>
        )}
        <Stat label="被ばく過多" value={`${session.overdoseCount}`} warn={session.overdoseCount > 0} />
      </div>

      <section className="review-list">
        <h2>復習リスト（外した部位と未撃破）</h2>
        {review.length === 0 ? (
          <p className="muted">外した部位はありません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>部位・方向</th>
                  <th className="num">自分の条件</th>
                  <th className="num">正解</th>
                  <th>判定</th>
                  <th>解説</th>
                </tr>
              </thead>
              <tbody>
                {review.map((r, i) => {
                  const c = byId.get(r.conditionId)
                  return (
                    <tr key={i}>
                      <td>
                        {c ? `${c.part} ${c.view}` : r.conditionId}
                        {c?.position && <span className="muted small">（{c.position}）</span>}
                      </td>
                      <td className="num mono">{r.input ? `${r.input.kv} kV・${r.input.mas} mAs・${r.input.sid} cm` : '—'}</td>
                      <td className="num mono answer">{c ? `${c.kv} kV・${c.mas} mAs・${c.sid} cm` : ''}</td>
                      <td>
                        {r.result === 'BREACH'
                          ? '未撃破'
                          : r.deviations.map((d) => DEVIATION_LABELS[d].split(' →')[0]).join('、')}
                      </td>
                      <td className="tip">{c?.tip}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="result-actions">
        <button onClick={() => onStageSelect(config.mode)}>{hard ? 'モード選択' : 'ステージ選択'}</button>
        <button onClick={retryMissed} disabled={missed.length === 0}>
          外した部位だけ再挑戦（{missed.length}）
        </button>
        <button className="primary" onClick={() => onPlay(config)}>
          もう一度
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`stat${warn ? ' warn' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
      {sub && <div className="stat-sub muted">{sub}</div>}
    </div>
  )
}
