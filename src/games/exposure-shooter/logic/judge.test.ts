import { describe, expect, it } from 'vitest'
import { judge, masStepDiff, resolveTolerance } from './judge'
import type { Condition } from './master'
import { DEFAULT_MAS_SERIES } from './masSeries'

const cond: Condition = {
  id: 'knee_lat',
  region: 'lower_limb',
  part: '膝関節',
  view: '側面',
  kv: 60,
  mas: 5,
  sid: 100,
  frequency: 'high',
  character: 'knee_lat',
}
const series = DEFAULT_MAS_SERIES
const standard = { kv: 5, masSteps: 1 }
const hard = { kv: 2, masSteps: 0 }

describe('masStepDiff', () => {
  it('系列上の段数差を返す', () => {
    expect(masStepDiff(series, 6.3, 5)).toBe(1)
    expect(masStepDiff(series, 4, 5)).toBe(-1)
    expect(masStepDiff(series, 10, 5)).toBe(3)
    expect(masStepDiff(series, 5, 5)).toBe(0)
  })
})

describe('judge', () => {
  it('3 つとも完全一致なら PERFECT', () => {
    expect(judge(cond, { kv: 60, mas: 5, sid: 100 }, standard, series)).toEqual({
      result: 'PERFECT',
      deviations: [],
      overdose: false,
    })
  })

  it('すべて許容範囲内なら GOOD（境界を含む）', () => {
    expect(judge(cond, { kv: 65, mas: 6.3, sid: 100 }, standard, series).result).toBe('GOOD')
    expect(judge(cond, { kv: 55, mas: 4, sid: 100 }, standard, series).result).toBe('GOOD')
  })

  it('kV が許容を超えると MISS。高すぎは被ばく過多', () => {
    const r = judge(cond, { kv: 70, mas: 5, sid: 100 }, standard, series)
    expect(r).toEqual({ result: 'MISS', deviations: ['kv_high'], overdose: true })
    const low = judge(cond, { kv: 50, mas: 5, sid: 100 }, standard, series)
    expect(low).toEqual({ result: 'MISS', deviations: ['kv_low'], overdose: false })
  })

  it('mAs が 2 段ずれると MISS。過剰は被ばく過多、不足はそうでない', () => {
    expect(judge(cond, { kv: 60, mas: 8, sid: 100 }, standard, series)).toEqual({
      result: 'MISS',
      deviations: ['mas_high'],
      overdose: true,
    })
    expect(judge(cond, { kv: 60, mas: 3.2, sid: 100 }, standard, series)).toEqual({
      result: 'MISS',
      deviations: ['mas_low'],
      overdose: false,
    })
  })

  it('撮影距離は完全一致が必要', () => {
    const r = judge(cond, { kv: 60, mas: 5, sid: 150 }, standard, series)
    expect(r.result).toBe('MISS')
    expect(r.deviations).toEqual(['sid'])
  })

  it('ずれは該当するものをすべて返す', () => {
    const r = judge(cond, { kv: 80, mas: 1, sid: 180 }, standard, series)
    expect(r.deviations).toEqual(['kv_high', 'mas_low', 'sid'])
    expect(r.overdose).toBe(true)
  })

  it('ハードの許容値では ±1 段や ±5 kV も MISS', () => {
    expect(judge(cond, { kv: 60, mas: 6.3, sid: 100 }, hard, series).result).toBe('MISS')
    expect(judge(cond, { kv: 62, mas: 5, sid: 100 }, hard, series).result).toBe('GOOD')
    expect(judge(cond, { kv: 63, mas: 5, sid: 100 }, hard, series).result).toBe('MISS')
  })

  it('グリッドは判定に使わない', () => {
    const r = judge({ ...cond, grid: true }, { kv: 60, mas: 5, sid: 100 }, standard, series)
    expect(r.result).toBe('PERFECT')
  })
})

describe('resolveTolerance', () => {
  it('行の個別許容値があればそちらを使う', () => {
    expect(resolveTolerance(cond, standard)).toEqual(standard)
    expect(resolveTolerance({ ...cond, kv_tol: 3 }, standard)).toEqual({ kv: 3, masSteps: 1 })
    expect(resolveTolerance({ ...cond, mas_tol_steps: 0 }, standard)).toEqual({ kv: 5, masSteps: 0 })
  })

  it('個別許容値は判定に効く', () => {
    const strict = resolveTolerance({ ...cond, kv_tol: 0 }, standard)
    expect(judge(cond, { kv: 65, mas: 5, sid: 100 }, strict, series).result).toBe('MISS')
  })
})
