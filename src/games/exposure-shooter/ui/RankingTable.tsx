import { useState } from 'react'
import type { RankTable, ShooterRankEntry } from '../logic/rankingRules'
import { RANKING_SIZE } from '../../../core/ranking/ranking'

/**
 * アーケード風のハイスコア表（SPEC 10.1）：等幅の数字、1〜3 位を金・銀・銅、行が順に表示される。
 * highlightId の行は強調し、onRename があれば名前をその場で直せる。
 */
export function RankingTable({
  table,
  entries,
  highlightId,
  onRename,
}: {
  table: RankTable
  entries: readonly ShooterRankEntry[]
  highlightId?: string
  onRename?: (name: string) => void
}) {
  const hard = table.mode === 'hard'
  const rows = Array.from({ length: RANKING_SIZE }, (_, i) => entries[i])
  return (
    <table className="ranking">
      <thead>
        <tr>
          <th>順位</th>
          <th>名前</th>
          <th className="num">{hard ? '撃破' : 'スコア'}</th>
          <th className="num">{hard ? '到達時間' : '撃破'}</th>
          <th className="num">正答率</th>
          <th className="num">最高コンボ</th>
          <th className="num">日付</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e, i) => (
          <tr
            key={e?.id ?? `empty${i}`}
            className={`rank-row place-${i + 1}${e && e.id === highlightId ? ' highlight' : ''}`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <td className="mono place">{ordinal(i + 1)}</td>
            {e ? (
              <>
                <td className="name">
                  {e.id === highlightId && onRename ? <NameInput initial={e.name} onCommit={onRename} /> : e.name}
                </td>
                <td className="num mono">{hard ? e.kills : e.score.toLocaleString()}</td>
                <td className="num mono">{hard ? mmss(e.timeSec ?? 0) : e.kills}</td>
                <td className="num mono">{Math.round(e.accuracy * 100)}%</td>
                <td className="num mono">{e.maxCombo}</td>
                <td className="num mono">{e.at.slice(0, 10).replace(/-/g, '/')}</td>
              </>
            ) : (
              <td colSpan={6} className="empty mono">
                ---
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 打つたびに保存する（入力したまま画面を閉じても残るように）。空にしたときは保存しない */
function NameInput({ initial, onCommit }: { initial: string; onCommit: (name: string) => void }) {
  const [name, setName] = useState(initial)
  return (
    <input
      className="rank-name-input"
      value={name}
      maxLength={16}
      aria-label="ランキングに載せる名前"
      onChange={(e) => {
        setName(e.target.value)
        if (e.target.value.trim()) onCommit(e.target.value.trim())
      }}
      onBlur={() => setName((n) => n.trim() || initial)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function ordinal(n: number) {
  return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`
}

export function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}
