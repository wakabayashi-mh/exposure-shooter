import { describe, expect, it } from 'vitest'
import type { Condition, Frequency } from './master'
import { pickEnemy, rollLowTarget, stagePool, type SpawnContext } from './spawn'

const c = (id: string, frequency: Frequency, region: Condition['region'] = 'spine'): Condition => ({
  id,
  region,
  part: id,
  view: '正面',
  kv: 60,
  mas: 5,
  sid: 100,
  frequency,
  character: id,
})
const pool = [c('h1', 'high'), c('h2', 'high'), c('m1', 'mid'), c('l1', 'low')]
const ctx = (over: Partial<SpawnContext> = {}): SpawnContext => ({
  elapsedRatio: 0,
  lowSpawned: 0,
  lowTarget: 2,
  onField: [],
  ...over,
})

/** 決まった値を順に返す乱数 */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('pickEnemy', () => {
  it('序盤は low を出さない', () => {
    for (let r = 0; r < 1; r += 0.05) {
      expect(pickEnemy(pool, ctx(), () => r)?.frequency).not.toBe('low')
    }
  })

  it('high は mid より出やすい（重み 3:2）', () => {
    // 重みの合計 8（h1:3, h2:3, m1:2）。0.75 以上で m1
    expect(pickEnemy(pool, ctx(), seq(0.76))?.id).toBe('m1')
    expect(pickEnemy(pool, ctx(), seq(0.74))?.id).toBe('h2')
    expect(pickEnemy(pool, ctx(), seq(0.1))?.id).toBe('h1')
    expect(pickEnemy(pool, ctx(), seq(0.5))?.id).toBe('h2')
  })

  it('終盤は low を混ぜる', () => {
    expect(pickEnemy(pool, ctx({ elapsedRatio: 0.8 }), seq(0.1, 0))?.id).toBe('l1')
  })

  it('low は目標数を出したらもう出さない', () => {
    expect(pickEnemy(pool, ctx({ elapsedRatio: 0.8, lowSpawned: 2 }), seq(0.1, 0))?.frequency).not.toBe('low')
  })

  it('画面にいる敵とはできるだけ重ねない', () => {
    expect(pickEnemy(pool, ctx({ onField: ['h1', 'h2'] }), seq(0))?.id).toBe('m1')
  })

  it('全部画面にいるなら重なってもよい', () => {
    expect(pickEnemy([c('h1', 'high')], ctx({ onField: ['h1'] }), seq(0))?.id).toBe('h1')
  })

  it('high / mid がない region は low から出す', () => {
    expect(pickEnemy([c('l1', 'low')], ctx(), seq(0.9))?.id).toBe('l1')
  })

  it('空のプールなら undefined', () => {
    expect(pickEnemy([], ctx(), seq(0))).toBeUndefined()
  })
})

describe('stagePool / rollLowTarget', () => {
  it('region で絞り込む', () => {
    expect(stagePool([c('a', 'high', 'spine'), c('b', 'high', 'head_neck')], 'spine').map((x) => x.id)).toEqual(['a'])
  })

  it('low の数は 1〜2', () => {
    expect(rollLowTarget(() => 0)).toBe(1)
    expect(rollLowTarget(() => 0.99)).toBe(2)
  })
})
