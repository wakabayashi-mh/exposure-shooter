import type { Difficulty, Mode } from './constants'
import type { Region } from './master'
import type { EnemyRecord } from './session'

/** 1 プレイの学習履歴（SPEC 10：敵 1 体ごとの id・結果・入力した条件・撃破までの時間） */
export interface PlayLog {
  /** プレイした日時（ISO 文字列） */
  at: string
  mode: Mode
  difficulty: Difficulty
  region?: Region
  status: 'cleared' | 'gameover'
  score: number
  records: EnemyRecord[]
}

/** 撮影ごとの成績 */
export interface PartStats {
  id: string
  /** 出てきた回数（撃てずに到達したものも含む） */
  attempts: number
  perfect: number
  good: number
  miss: number
  breach: number
  /** 正答率（撃破 ÷ 出てきた回数） */
  accuracy: number
  /** 撃破までの平均時間 [ms]。撃破がなければ null */
  avgKillMs: number | null
}

export function aggregate(plays: readonly PlayLog[]): PartStats[] {
  const map = new Map<string, PartStats & { killMsTotal: number }>()
  for (const play of plays) {
    for (const r of play.records) {
      const s =
        map.get(r.conditionId) ??
        { id: r.conditionId, attempts: 0, perfect: 0, good: 0, miss: 0, breach: 0, accuracy: 0, avgKillMs: null, killMsTotal: 0 }
      s.attempts++
      if (r.result === 'PERFECT') s.perfect++
      if (r.result === 'GOOD') s.good++
      if (r.result === 'MISS') s.miss++
      if (r.result === 'BREACH') s.breach++
      if (r.result === 'PERFECT' || r.result === 'GOOD') s.killMsTotal += r.elapsedMs
      map.set(r.conditionId, s)
    }
  }
  return [...map.values()].map(({ killMsTotal, ...s }) => {
    const kills = s.perfect + s.good
    return { ...s, accuracy: kills / s.attempts, avgKillMs: kills > 0 ? killMsTotal / kills : null }
  })
}

/** 苦手な撮影：正答率が低い順（同じなら出てきた回数が多い順）。全問正解の撮影は入れない */
export function weakest(stats: readonly PartStats[], limit = 5, minAttempts = 2): PartStats[] {
  return stats
    .filter((s) => s.attempts >= minAttempts && s.accuracy < 1)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, limit)
}

/** 書き出し用：敵 1 体を 1 行にする */
export const HISTORY_CSV_HEADERS = ['日時', 'モード', '難易度', 'ステージ', 'id', '結果', '入力kV', '入力mAs', '入力距離', 'ずれ', '撃破までの秒'] as const

export function historyRows(plays: readonly PlayLog[]): (string | number)[][] {
  return plays.flatMap((p) =>
    p.records.map((r) => [
      p.at,
      p.mode,
      p.difficulty,
      p.region ?? '',
      r.conditionId,
      r.result,
      r.input?.kv ?? '',
      r.input?.mas ?? '',
      r.input?.sid ?? '',
      r.deviations.join(' '),
      Math.round(r.elapsedMs / 100) / 10,
    ]),
  )
}
