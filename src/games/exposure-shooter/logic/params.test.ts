import { describe, expect, it } from 'vitest'
import { kvOptions, nearestOption, nextParam, stepOption } from './params'

describe('ダイヤル', () => {
  it('kV の選択肢は min から step 刻み', () => {
    expect(kvOptions(40, 60, 5)).toEqual([40, 45, 50, 55, 60])
    expect(kvOptions(40, 45, 2)).toEqual([40, 42, 44])
  })

  it('1 刻み動かし、端で止める（ループしない）', () => {
    const opts = [100, 150, 180]
    expect(stepOption(opts, 100, 1)).toBe(150)
    expect(stepOption(opts, 180, 1)).toBe(180)
    expect(stepOption(opts, 100, -1)).toBe(100)
  })

  it('選択肢にない値からは最も近い値を基準に動かす', () => {
    expect(nearestOption([0.5, 1, 2, 5, 10], 9)).toBe(10)
    expect(stepOption([0.5, 1, 2, 5, 10], 9, -1)).toBe(5)
  })

  it('パラメータは kV → mAs → 撮影距離 → kV の順に切り替わる', () => {
    expect(nextParam('kv')).toBe('mas')
    expect(nextParam('mas')).toBe('sid')
    expect(nextParam('sid')).toBe('kv')
  })
})
