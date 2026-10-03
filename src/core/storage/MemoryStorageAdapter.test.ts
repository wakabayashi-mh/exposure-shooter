import { describe, expect, it } from 'vitest'
import { MemoryStorageAdapter } from './MemoryStorageAdapter'

describe('MemoryStorageAdapter', () => {
  it('get / set / remove / list', async () => {
    const s = new MemoryStorageAdapter()
    await s.set('game-a/master', [1, 2])
    await s.set('game-a/settings', { v: 1 })
    await s.set('game-b/master', [])
    expect(await s.get('game-a/master')).toEqual([1, 2])
    expect((await s.list('game-a/')).sort()).toEqual(['game-a/master', 'game-a/settings'])
    await s.remove('game-a/master')
    expect(await s.get('game-a/master')).toBeUndefined()
    expect(await s.list()).toHaveLength(2)
  })

  it('保存した値は複製され、呼び出し側の変更が漏れない', async () => {
    const s = new MemoryStorageAdapter()
    const value = { a: 1 }
    await s.set('k', value)
    value.a = 2
    expect(await s.get('k')).toEqual({ a: 1 })
  })
})
