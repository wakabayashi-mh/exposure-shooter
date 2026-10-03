import { describe, expect, it } from 'vitest'
import { buildSidOptions, FALLBACK_SID_OPTIONS } from './sidOptions'

describe('buildSidOptions', () => {
  it('マスタの sid から重複を除いて昇順に作る', () => {
    const { options } = buildSidOptions([{ sid: 180 }, { sid: 100 }, { sid: 120 }, { sid: 100 }])
    expect(options).toEqual([100, 120, 180])
  })

  it('初期値は最も多く使われている sid', () => {
    expect(buildSidOptions([{ sid: 100 }, { sid: 120 }, { sid: 120 }]).initial).toBe(120)
  })

  it('同数なら短い方を初期値にする', () => {
    expect(buildSidOptions([{ sid: 150 }, { sid: 100 }]).initial).toBe(100)
  })

  it('マスタが空なら仮の選択肢を使う', () => {
    const { options, initial } = buildSidOptions([])
    expect(options).toEqual(FALLBACK_SID_OPTIONS)
    expect(initial).toBe(100)
  })
})
