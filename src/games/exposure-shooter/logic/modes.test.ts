import { describe, expect, it } from 'vitest'
import type { Condition, Frequency } from './master'
import { hardLowWeight, hardSpawnIntervalSec, missedIds, pickHardEnemy, rankFor, toleranceFor } from './modes'
import { createSession, type EnemyRecord } from './session'

const c = (id: string, frequency: Frequency): Condition => ({
  id,
  region: 'spine',
  part: id,
  view: '正面',
  kv: 60,
  mas: 5,
  sid: 100,
  frequency,
  character: id,
})
const rec = (conditionId: string, result: EnemyRecord['result']): EnemyRecord => ({
  conditionId,
  result,
  deviations: [],
  elapsedMs: 0,
  points: 0,
})
const session = (results: EnemyRecord['result'][]) => ({
  ...createSession(5),
  records: results.map((r, i) => rec(`c${i}`, r)),
})

describe('toleranceFor', () => {
  it('スタンダード・復習は選んだ難易度の許容値', () => {
    expect(toleranceFor('standard', 'beginner')).toEqual({ kv: 5, masSteps: 1 })
    expect(toleranceFor('review', 'hard')).toEqual({ kv: 2, masSteps: 0 })
  })
  it('ハードモードは難易度にかかわらずハードの許容値', () => {
    expect(toleranceFor('hard', 'beginner')).toEqual({ kv: 2, masSteps: 0 })
  })
})

describe('ハードモードの出現', () => {
  it('時間とともに出現間隔が短くなり、下限で止まる', () => {
    expect(hardSpawnIntervalSec(0)).toBe(4.5)
    expect(hardSpawnIntervalSec(60)).toBeCloseTo(3.6)
    expect(hardSpawnIntervalSec(1000)).toBe(2.5)
  })

  it('時間とともに low が出やすくなり、上限で止まる', () => {
    expect(hardLowWeight(0)).toBe(0.5)
    expect(hardLowWeight(60)).toBeCloseTo(1.5)
    expect(hardLowWeight(1000)).toBe(3)
  })

  it('全体から重み付きで選び、序盤より終盤のほうが low を引きやすい', () => {
    const pool = [c('h', 'high'), c('m', 'mid'), c('l', 'low')]
    // 重みの合計: 序盤 3+2+0.5=5.5、終盤 3+2+3=8。r=0.8 は序盤 4.4（m）、終盤 6.4（l）
    expect(pickHardEnemy(pool, 0, [], () => 0.8)?.id).toBe('m')
    expect(pickHardEnemy(pool, 1000, [], () => 0.8)?.id).toBe('l')
  })

  it('画面にいる敵とはできるだけ重ねない', () => {
    const pool = [c('h', 'high'), c('m', 'mid')]
    expect(pickHardEnemy(pool, 0, ['h'], () => 0)?.id).toBe('m')
  })
})

describe('missedIds', () => {
  it('MISS と未撃破の id を、重複なしで最初に外した順に返す', () => {
    const records = [rec('a', 'GOOD'), rec('b', 'MISS'), rec('c', 'BREACH'), rec('b', 'BREACH'), rec('d', 'PERFECT')]
    expect(missedIds(records)).toEqual(['b', 'c'])
  })
})

describe('rankFor', () => {
  it('撃破率 90% 以上かつ PERFECT 60% 以上で S', () => {
    const s = session(['PERFECT', 'PERFECT', 'PERFECT', 'PERFECT', 'PERFECT', 'PERFECT', 'GOOD', 'GOOD', 'GOOD', 'MISS'])
    expect(rankFor(s, true)).toBe('S')
  })
  it('撃破率 90% でも PERFECT が少なければ A', () => {
    const s = session(['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD', 'MISS'])
    expect(rankFor(s, true)).toBe('A')
  })
  it('撃破率 60% 以上で B、それ未満は C', () => {
    expect(rankFor(session(['GOOD', 'GOOD', 'GOOD', 'MISS', 'BREACH']), true)).toBe('B')
    expect(rankFor(session(['GOOD', 'MISS', 'BREACH']), true)).toBe('C')
  })
  it('ゲームオーバーと記録なしは C', () => {
    expect(rankFor(session(['PERFECT', 'PERFECT']), false)).toBe('C')
    expect(rankFor(session([]), true)).toBe('C')
  })
})
