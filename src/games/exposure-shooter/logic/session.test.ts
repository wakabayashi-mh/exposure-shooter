import { describe, expect, it } from 'vitest'
import type { JudgeResult } from './judge'
import { applyBreach, applyShot, comboMultiplier, createSession, pointsFor, type Shot } from './session'

const input = { kv: 60, mas: 5, sid: 100 }
const shot = (judge: JudgeResult, remainingRatio = 0): Shot => ({
  conditionId: 'a',
  judge,
  input,
  remainingRatio,
  elapsedMs: 1000,
})
const PERFECT: JudgeResult = { result: 'PERFECT', deviations: [], overdose: false }
const GOOD: JudgeResult = { result: 'GOOD', deviations: [], overdose: false }
const MISS_OVER: JudgeResult = { result: 'MISS', deviations: ['mas_high'], overdose: true }
const MISS_UNDER: JudgeResult = { result: 'MISS', deviations: ['kv_low'], overdose: false }

describe('スコア', () => {
  it('コンボ倍率は ×1 から ×0.5 ずつ上がり、上限 ×4', () => {
    expect([0, 1, 2, 5, 6, 20].map(comboMultiplier)).toEqual([1, 1.5, 2, 3.5, 4, 4])
  })

  it('PERFECT 300 点、GOOD 100 点、MISS 0 点', () => {
    expect(pointsFor('PERFECT', 0, 0)).toBe(300)
    expect(pointsFor('GOOD', 0, 0)).toBe(100)
    expect(pointsFor('MISS', 3, 1)).toBe(0)
  })

  it('早撃ちボーナスは残り接近時間に比例して最大 +50%', () => {
    expect(pointsFor('GOOD', 0, 1)).toBe(150)
    expect(pointsFor('GOOD', 0, 0.5)).toBe(125)
    expect(pointsFor('PERFECT', 2, 1)).toBe(300 * 2 * 1.5)
  })
})

describe('セッション', () => {
  it('撃破でスコアとコンボが積み上がる', () => {
    let s = createSession(5)
    s = applyShot(s, shot(PERFECT), true)
    s = applyShot(s, shot(GOOD), true)
    expect(s.score).toBe(300 + 150)
    expect(s.combo).toBe(2)
    expect(s.maxCombo).toBe(2)
    expect(s.lives).toBe(5)
    expect(s.records.map((r) => r.result)).toEqual(['PERFECT', 'GOOD'])
  })

  it('MISS はライフ −1、コンボリセット、過剰方向なら被ばく過多に数える', () => {
    let s = applyShot(createSession(5), shot(GOOD), true)
    s = applyShot(s, shot(MISS_OVER), true)
    expect(s.lives).toBe(4)
    expect(s.combo).toBe(0)
    expect(s.maxCombo).toBe(1)
    expect(s.overdoseCount).toBe(1)
    s = applyShot(s, shot(MISS_UNDER), true)
    expect(s.overdoseCount).toBe(1)
    expect(s.records.at(-1)?.deviations).toEqual(['kv_low'])
  })

  it('ビギナーは MISS でライフが減らない', () => {
    const s = applyShot(createSession(4), shot(MISS_UNDER), false)
    expect(s.lives).toBe(4)
    expect(s.combo).toBe(0)
  })

  it('防衛ライン到達はライフ −1、コンボリセット、未撃破として記録', () => {
    let s = applyShot(createSession(4), shot(GOOD), false)
    s = applyBreach(s, 'b', 10000)
    expect(s.lives).toBe(3)
    expect(s.combo).toBe(0)
    expect(s.records.at(-1)).toMatchObject({ conditionId: 'b', result: 'BREACH', points: 0 })
  })
})
