import { useEffect, useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../logic/constants'
import { REGION_LABELS, REGIONS, type Region } from '../logic/master'
import { allTables, tableKey, tableLabel, type RankTable } from '../logic/rankingRules'
import { useRankingStore } from '../rankingStore'
import { RankingTable } from './RankingTable'

const DIFFS = Object.keys(DIFFICULTIES) as Difficulty[]

/** ハイスコア画面（SPEC 10.1）：モード × ステージ × 難易度ごとのランキング */
export function RankingScreen({ onBack }: { onBack: () => void }) {
  const tables = useRankingStore((s) => s.tables)
  // 最初は記録のある表を開く
  const [table, setTable] = useState<RankTable>(
    () => allTables().find((t) => (tables[tableKey(t)] ?? []).length > 0) ?? allTables()[0],
  )
  const region: Region = table.mode === 'standard' ? table.region : 'chest_abdomen'
  const has = (t: RankTable) => (tables[tableKey(t)] ?? []).length > 0

  return (
    <div className="screen ranking-screen">
      <header className="screen-header">
        <button onClick={onBack}>← モード選択</button>
        <h1>ハイスコア</h1>
        <span className="muted">この端末のプロフィールだけで競うランキング</span>
      </header>
      <div className="ranking-body">
        <div className="ranking-pickers">
          <div className="segmented small-seg">
            <button className={table.mode === 'standard' ? 'on' : ''} onClick={() => setTable({ mode: 'standard', difficulty: table.difficulty, region })}>
              スタンダード
            </button>
            <button className={table.mode === 'hard' ? 'on' : ''} onClick={() => setTable({ mode: 'hard', difficulty: table.difficulty })}>
              ハード（無制限）
            </button>
          </div>
          {table.mode === 'standard' && (
            <div className="segmented small-seg">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  className={`${r === table.region ? 'on' : ''}${has({ ...table, region: r }) ? ' has' : ''}`}
                  onClick={() => setTable({ ...table, region: r })}
                >
                  {REGION_LABELS[r]}
                </button>
              ))}
            </div>
          )}
          <div className="segmented small-seg">
            {DIFFS.map((d) => (
              <button key={d} className={d === table.difficulty ? 'on' : ''} onClick={() => setTable({ ...table, difficulty: d })}>
                {DIFFICULTIES[d].label}
              </button>
            ))}
          </div>
        </div>
        <h2 className="ranking-title">{tableLabel(table)}</h2>
        <RankingTable key={tableKey(table)} table={table} entries={tables[tableKey(table)] ?? []} />
      </div>
    </div>
  )
}

/**
 * タイトルで操作がないときに、アーケードのデモ画面のようにランキングを順に見せる（SPEC 10.1）。
 * 記録のある表だけを 5 秒ずつ切り替える。
 */
export function RankingAttract() {
  const tables = useRankingStore((s) => s.tables)
  const list = allTables().filter((t) => (tables[tableKey(t)] ?? []).length > 0)
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])
  if (list.length === 0) return null
  const t = list[i % list.length]
  return (
    <div className="attract">
      <div className="attract-title mono">HIGH SCORE</div>
      <div className="attract-sub">撮影条件シューティング　{tableLabel(t)}</div>
      <RankingTable key={`${tableKey(t)}-${i}`} table={t} entries={tables[tableKey(t)]} />
      <div className="attract-hint">画面に触れるか、キーを押すと戻ります</div>
    </div>
  )
}
