import { describe, expect, it } from 'vitest'
import { buildMasSeries, DEFAULT_MAS_SERIES } from './masSeries'

describe('buildMasSeries', () => {
  it('マスタが系列内の値だけなら既定系列のまま', () => {
    const { series, added } = buildMasSeries([{ mas: 5 }, { mas: 12.5 }])
    expect(series).toEqual(DEFAULT_MAS_SERIES)
    expect(added).toEqual([])
  })

  it('系列にない値は丸めずに追加し、昇順に並べ直す', () => {
    const { series, added } = buildMasSeries([{ mas: 7 }, { mas: 0.4 }, { mas: 7 }, { mas: 250 }])
    expect(added).toEqual([0.4, 7, 250])
    expect(series[0]).toBe(0.4)
    expect(series.at(-1)).toBe(250)
    expect(series.indexOf(7)).toBe(series.indexOf(6.3) + 1)
    expect(series.length).toBe(DEFAULT_MAS_SERIES.length + 3)
  })

  it('マスタから値が消えれば系列からも消える（毎回作り直す）', () => {
    expect(buildMasSeries([{ mas: 7 }]).series).toContain(7)
    expect(buildMasSeries([]).series).not.toContain(7)
  })
})
