/**
 * アーケード風のローカルランキング（SPEC 10.1）。表ごとに上位 N 件を残す純粋関数。
 * 同じプロフィールが複数の順位に入ってもよい。
 */

export const RANKING_SIZE = 10

export interface RankEntry {
  /** この記録の一意 ID（結果画面で名前を直すときに使う） */
  id: string
  name: string
  profileId: string
  /** 記録した日時（ISO 文字列） */
  at: string
}

export interface InsertResult<E> {
  entries: E[]
  /** 入った順位（1 始まり）。圏外なら null */
  rank: number | null
}

/**
 * 記録を入れて並べ直し、上位 size 件だけ残す。
 * better(a, b) が負なら a が上。同点は先に記録したほうが上（アーケードと同じ）。
 */
export function insertEntry<E extends RankEntry>(
  entries: readonly E[],
  entry: E,
  better: (a: E, b: E) => number,
  size = RANKING_SIZE,
): InsertResult<E> {
  const sorted = [...entries, entry].sort((a, b) => better(a, b) || a.at.localeCompare(b.at))
  const kept = sorted.slice(0, size)
  const i = kept.indexOf(entry)
  return { entries: kept, rank: i >= 0 ? i + 1 : null }
}

/** 名前を付け直す（結果画面でその場で変更する, SPEC 10.1） */
export function renameEntry<E extends RankEntry>(entries: readonly E[], id: string, name: string): E[] {
  return entries.map((e) => (e.id === id ? { ...e, name } : e))
}
