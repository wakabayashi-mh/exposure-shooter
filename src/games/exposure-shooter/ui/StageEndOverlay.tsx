import { DEVIATION_LABELS } from '../logic/judge'
import type { Condition } from '../logic/master'
import { usePlayStore } from '../playStore'

/**
 * ステージ終了の表示（フェーズ 2 の簡易版）。
 * フェーズ 3 で結果・復習画面（SPEC 9.2）に置き換える。
 */
export function StageEndOverlay({
  pool,
  onRetry,
  onBack,
}: {
  pool: Condition[]
  onRetry: () => void
  onBack: () => void
}) {
  const { status, result, stageName } = usePlayStore()
  if (!result) return null
  const byId = new Map(pool.map((c) => [c.id, c]))
  const count = (r: string) => result.records.filter((x) => x.result === r).length
  const review = result.records.filter((r) => r.result === 'MISS' || r.result === 'BREACH')

  return (
    <div className="end-overlay">
      <div className="end-card">
        <h1>{status === 'cleared' ? 'ステージクリア' : 'ゲームオーバー'}</h1>
        <p className="muted">{stageName}</p>
        <div className="end-stats">
          <Stat label="スコア" value={result.score.toLocaleString()} />
          <Stat label="撃破" value={`${count('PERFECT') + count('GOOD')}`} sub={`PERFECT ${count('PERFECT')} / GOOD ${count('GOOD')}`} />
          <Stat label="MISS" value={`${count('MISS')}`} />
          <Stat label="未撃破" value={`${count('BREACH')}`} />
          <Stat label="最高コンボ" value={`${result.maxCombo}`} />
          <Stat label="被ばく過多" value={`${result.overdoseCount}`} />
        </div>

        {review.length > 0 && (
          <div className="review">
            <table>
              <thead>
                <tr>
                  <th>部位・方向</th>
                  <th>あなたの条件</th>
                  <th>正解</th>
                  <th>判定</th>
                </tr>
              </thead>
              <tbody>
                {review.map((r, i) => {
                  const c = byId.get(r.conditionId)
                  return (
                    <tr key={i}>
                      <td>{c ? `${c.part} ${c.view}` : r.conditionId}</td>
                      <td className="mono">{r.input ? `${r.input.kv} / ${r.input.mas} / ${r.input.sid}` : '—'}</td>
                      <td className="mono">{c ? `${c.kv} / ${c.mas} / ${c.sid}` : ''}</td>
                      <td>
                        {r.result === 'BREACH'
                          ? '未撃破'
                          : r.deviations.map((d) => DEVIATION_LABELS[d].split(' →')[0]).join('、')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="actions">
          <button className="primary" onClick={onRetry}>
            もう一度
          </button>
          <button onClick={onBack}>タイトルへ</button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
      {sub && <div className="stat-sub muted">{sub}</div>}
    </div>
  )
}
