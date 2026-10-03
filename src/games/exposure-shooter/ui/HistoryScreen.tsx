import { useEffect, useState } from 'react'
import { downloadText, toCsv } from '../../../core/data/tableFile'
import { clearHistory, loadHistory } from '../../../core/history/history'
import { useProfileStore } from '../../../core/profile/profileStore'
import { ProfileSwitcher } from '../../../core/profile/ProfileSwitcher'
import { aggregate, HISTORY_CSV_HEADERS, historyRows, weakest, type PartStats, type PlayLog } from '../logic/historyStats'
import { useMasterStore } from '../masterStore'

const GAME_ID = 'exposure-shooter'

/** 学習履歴（SPEC 10）：撮影ごとの正答率・平均撃破時間、苦手な撮影、書き出し */
export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const { currentId, profiles } = useProfileStore()
  const name = profiles.find((p) => p.id === currentId)?.name ?? ''
  const conditions = useMasterStore((s) => s.conditions)
  const [plays, setPlays] = useState<PlayLog[] | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    setPlays(null)
    void loadHistory<PlayLog>(GAME_ID, currentId).then(setPlays)
  }, [currentId])

  const byId = new Map(conditions.map((c) => [c.id, c]))
  const label = (id: string) => {
    const c = byId.get(id)
    return c ? `${c.part} ${c.view}` : `${id}（マスタにない撮影）`
  }
  const stats = plays ? aggregate(plays).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts) : []
  const weak = weakest(stats)
  const date = new Date().toISOString().slice(0, 10)

  const exportJson = () => downloadText(`学習履歴_${name}_${date}.json`, JSON.stringify(plays, null, 2), 'application/json')
  const exportCsv = () => downloadText(`学習履歴_${name}_${date}.csv`, toCsv(HISTORY_CSV_HEADERS, historyRows(plays ?? [])), 'text/csv;charset=utf-8')

  return (
    <div className="screen history">
      <header className="screen-header">
        <button onClick={onBack}>← モード選択</button>
        <h1>学習履歴</h1>
        <span className="muted">{plays ? `${plays.length} プレイ` : '読み込み中…'}</span>
        <div className="push-right header-actions">
          <ProfileSwitcher />
          <button onClick={exportCsv} disabled={!plays?.length}>CSV で書き出す</button>
          <button onClick={exportJson} disabled={!plays?.length}>JSON で書き出す</button>
        </div>
      </header>

      <div className="history-body">
        {plays && plays.length === 0 && <p className="muted">「{name}」の記録はまだありません。プレイを最後まで終えると記録されます。</p>}

        {weak.length > 0 && (
          <section>
            <h2>苦手な撮影（正答率の低い順）</h2>
            <ol className="weak-list">
              {weak.map((s) => (
                <li key={s.id}>
                  <span className="weak-name">{label(s.id)}</span>
                  <span className="mono">{pct(s)}</span>
                  <span className="muted small">{s.attempts} 回中 {s.perfect + s.good} 回撃破</span>
                  {byId.get(s.id) && (
                    <span className="mono answer small">
                      正解 {byId.get(s.id)!.kv} kV・{byId.get(s.id)!.mas} mAs・{byId.get(s.id)!.sid} cm
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {stats.length > 0 && (
          <section>
            <h2>撮影ごとの成績</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>部位・方向</th>
                    <th className="num">回数</th>
                    <th className="num">PERFECT</th>
                    <th className="num">GOOD</th>
                    <th className="num">MISS</th>
                    <th className="num">未撃破</th>
                    <th className="num">正答率</th>
                    <th className="num">平均撃破時間</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.id}>
                      <td>{label(s.id)}</td>
                      <td className="num mono">{s.attempts}</td>
                      <td className="num mono">{s.perfect}</td>
                      <td className="num mono">{s.good}</td>
                      <td className="num mono">{s.miss}</td>
                      <td className="num mono">{s.breach}</td>
                      <td className="num mono">
                        <span className="bar" style={{ width: `${s.accuracy * 60}px` }} />
                        {pct(s)}
                      </td>
                      <td className="num mono">{s.avgKillMs === null ? '—' : `${(s.avgKillMs / 1000).toFixed(1)} 秒`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {plays && plays.length > 0 && (
          <div className="history-clear">
            {confirmClear ? (
              <>
                「{name}」の学習履歴をすべて消しますか？（ランキングは消えません）
                <button
                  className="danger"
                  onClick={() => void clearHistory(GAME_ID, currentId).then(() => { setPlays([]); setConfirmClear(false) })}
                >
                  消す
                </button>
                <button onClick={() => setConfirmClear(false)}>やめる</button>
              </>
            ) : (
              <button onClick={() => setConfirmClear(true)}>この人の学習履歴を消す</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const pct = (s: PartStats) => `${Math.round(s.accuracy * 100)}%`
