import type { Condition } from './master'

/** mAs 標準系列（R'10 系列, SPEC 4.2） */
export const DEFAULT_MAS_SERIES: readonly number[] = [
  0.5, 0.63, 0.8, 1, 1.25, 1.6, 2, 2.5, 3.2, 4, 5, 6.3, 8, 10, 12.5, 16, 20, 25, 32, 40, 50, 63, 80,
  100, 125, 160, 200,
]

export interface MasSeries {
  /** ステップ送りで選ぶ値（昇順） */
  series: number[]
  /** 既定系列になくマスタから追加した値（昇順）。インポート結果に表示する */
  added: number[]
}

/**
 * 既定系列＋マスタにある値で mAs 系列を作る。系列にない値は丸めずにそのまま足す。
 * マスタを差し替えたときも毎回これで作り直す。
 */
export function buildMasSeries(conditions: readonly Pick<Condition, 'mas'>[]): MasSeries {
  const base = new Set(DEFAULT_MAS_SERIES)
  const added = [...new Set(conditions.map((c) => c.mas))].filter((v) => !base.has(v)).sort((a, b) => a - b)
  return { series: [...DEFAULT_MAS_SERIES, ...added].sort((a, b) => a - b), added }
}
