import { DIFFICULTIES, FREQUENCY_WEIGHT, HARD, RANK, type Difficulty, type Mode } from './constants'
import type { Tolerance } from './judge'
import type { Condition } from './master'
import type { EnemyRecord, SessionState } from './session'
import { weightedPick, type Rng } from './spawn'

/** 許容値。ハードモードは難易度にかかわらずハードの許容値を使う（SPEC 6.2） */
export function toleranceFor(mode: Mode, difficulty: Difficulty): Tolerance {
  const d = DIFFICULTIES[mode === 'hard' ? 'hard' : difficulty]
  return { kv: d.kvTol, masSteps: d.masTolSteps }
}

/** ハードモードの出現間隔。経過時間とともに短くなる */
export function hardSpawnIntervalSec(elapsedSec: number): number {
  return Math.max(HARD.spawnIntervalMinSec, HARD.spawnIntervalStartSec - HARD.intervalShrinkPerSec * elapsedSec)
}

/** ハードモードの low の出現の重み。経過時間とともに上がる */
export function hardLowWeight(elapsedSec: number): number {
  return Math.min(HARD.lowWeightMax, HARD.lowWeightStart + HARD.lowWeightGrowPerSec * elapsedSec)
}

/** ハードモードの次の敵（全 region から。画面にいる敵とはできるだけ重ねない） */
export function pickHardEnemy(
  pool: readonly Condition[],
  elapsedSec: number,
  onField: readonly string[],
  rng: Rng,
): Condition | undefined {
  if (pool.length === 0) return undefined
  const fresh = pool.filter((c) => !onField.includes(c.id))
  const list = fresh.length > 0 ? fresh : pool
  const lowWeight = hardLowWeight(elapsedSec)
  return weightedPick(list, (c) => (c.frequency === 'low' ? lowWeight : FREQUENCY_WEIGHT[c.frequency]), rng)
}

/** 外した部位（MISS と未撃破）の id。重複を除き、最初に外した順 */
export function missedIds(records: readonly EnemyRecord[]): string[] {
  return [...new Set(records.filter((r) => r.result === 'MISS' || r.result === 'BREACH').map((r) => r.conditionId))]
}

export type Rank = 'S' | 'A' | 'B' | 'C'

/** ランク（S / A / B / C）。撃破率と PERFECT 率で決め、ゲームオーバーは C */
export function rankFor(s: SessionState, cleared: boolean): Rank {
  const total = s.records.length
  if (!cleared || total === 0) return 'C'
  const perfect = s.records.filter((r) => r.result === 'PERFECT').length
  const kills = perfect + s.records.filter((r) => r.result === 'GOOD').length
  const killRate = kills / total
  if (killRate >= RANK.S.killRate && perfect / total >= RANK.S.perfectRate) return 'S'
  if (killRate >= RANK.A.killRate) return 'A'
  if (killRate >= RANK.B.killRate) return 'B'
  return 'C'
}
