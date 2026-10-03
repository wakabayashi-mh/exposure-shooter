import { FREQUENCY_WEIGHT, STAGE } from './constants'
import type { Condition, Region } from './master'

export type Rng = () => number

export interface SpawnContext {
  /** ステージの経過割合（0〜1） */
  elapsedRatio: number
  /** ここまでに出した low の数 */
  lowSpawned: number
  /** このステージで出す low の数 */
  lowTarget: number
  /** いま画面にいる敵の id（できるだけ同じ敵を重ねない） */
  onField: readonly string[]
}

export function stagePool(conditions: readonly Condition[], region: Region): Condition[] {
  return conditions.filter((c) => c.region === region)
}

/** 終盤に混ぜる low の数を決める（SPEC 6.1: 1〜2 体） */
export function rollLowTarget(rng: Rng): number {
  return STAGE.lowCountMin + Math.floor(rng() * (STAGE.lowCountMax - STAGE.lowCountMin + 1))
}

/**
 * スタンダードモードの次の敵を選ぶ（SPEC 6.1）。
 * high / mid を重み付きで選び、終盤（lowFromRatio 以降）に low を lowTarget 体まで混ぜる。
 */
export function pickEnemy(pool: readonly Condition[], ctx: SpawnContext, rng: Rng): Condition | undefined {
  if (pool.length === 0) return undefined
  const prefer = (list: readonly Condition[]) => {
    const fresh = list.filter((c) => !ctx.onField.includes(c.id))
    return fresh.length > 0 ? fresh : list
  }

  const lows = prefer(pool.filter((c) => c.frequency === 'low'))
  const wantLow = ctx.elapsedRatio >= STAGE.lowFromRatio && ctx.lowSpawned < ctx.lowTarget
  if (wantLow && lows.length > 0 && rng() < 0.5) return lows[Math.floor(rng() * lows.length)]

  const main = prefer(pool.filter((c) => c.frequency !== 'low'))
  if (main.length === 0) return lows[Math.floor(rng() * lows.length)]
  return weightedPick(main, (c) => FREQUENCY_WEIGHT[c.frequency as 'high' | 'mid'], rng)
}

function weightedPick<T>(items: readonly T[], weight: (t: T) => number, rng: Rng): T {
  const total = items.reduce((sum, t) => sum + weight(t), 0)
  let r = rng() * total
  for (const t of items) {
    r -= weight(t)
    if (r < 0) return t
  }
  return items[items.length - 1]
}
