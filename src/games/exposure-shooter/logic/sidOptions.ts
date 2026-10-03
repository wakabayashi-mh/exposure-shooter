import type { Condition } from './master'

/** マスタが空のときだけ使う仮の選択肢（SPEC 4.3） */
export const FALLBACK_SID_OPTIONS: readonly number[] = [100, 150, 180]

export interface SidOptions {
  /** 撮影距離の選択肢 [cm]（重複なし・昇順） */
  options: number[]
  /** 初期選択値。マスタで最も多い sid（同数なら短い方） */
  initial: number
}

export function buildSidOptions(conditions: readonly Pick<Condition, 'sid'>[]): SidOptions {
  if (conditions.length === 0) {
    return { options: [...FALLBACK_SID_OPTIONS], initial: FALLBACK_SID_OPTIONS[0] }
  }
  const counts = new Map<number, number>()
  for (const { sid } of conditions) counts.set(sid, (counts.get(sid) ?? 0) + 1)
  const options = [...counts.keys()].sort((a, b) => a - b)
  const initial = options.reduce((best, v) => (counts.get(v)! > counts.get(best)! ? v : best))
  return { options, initial }
}
