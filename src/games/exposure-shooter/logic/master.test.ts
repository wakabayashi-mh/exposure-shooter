import { describe, expect, it } from 'vitest'
import sample from '../../../../data/conditions.sample.json'
import { parseMaster, REGIONS } from './master'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'knee_lat',
  region: 'lower_limb',
  part: '膝関節',
  view: '側面',
  kv: 60,
  mas: 5,
  sid: 100,
  frequency: 'high',
  character: 'knee_lat',
  ...over,
})

describe('parseMaster', () => {
  it('正しい行をそのまま返す', () => {
    const { conditions, errors } = parseMaster([row()])
    expect(errors).toEqual([])
    expect(conditions).toHaveLength(1)
  })

  it('不正な行は行番号付きでエラーにし、残りの行は読み込む', () => {
    const { conditions, errors } = parseMaster([row(), row({ id: 'Bad-ID', kv: 'abc' })])
    expect(conditions).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(2)
    expect(errors[0].id).toBe('Bad-ID')
    expect(errors[0].messages.some((m) => m.startsWith('id:'))).toBe(true)
    expect(errors[0].messages.some((m) => m.startsWith('kv:'))).toBe(true)
  })

  it('region と frequency は決められた値だけ受け付ける', () => {
    const { errors } = parseMaster([row({ region: 'abdomen' }), row({ id: 'b', frequency: 'often' })])
    expect(errors.map((e) => e.row)).toEqual([1, 2])
  })

  it('ID が重複した 2 行目以降はエラーにする', () => {
    const { conditions, errors } = parseMaster([row(), row({ kv: 70 }), row({ kv: 80 })])
    expect(conditions).toHaveLength(1)
    expect(conditions[0].kv).toBe(60)
    expect(errors.map((e) => e.row)).toEqual([2, 3])
  })

  it('配列でない入力はエラー 1 件にする', () => {
    expect(parseMaster({}).errors).toHaveLength(1)
  })
})

describe('サンプルマスタ（data/conditions.sample.json）', () => {
  const { conditions, errors } = parseMaster(sample)

  it('全行が検証を通る', () => {
    expect(errors).toEqual([])
    expect(conditions.length).toBeGreaterThanOrEqual(10)
    expect(conditions.length).toBeLessThanOrEqual(15)
  })

  it('各 region に 2 行以上ある', () => {
    for (const region of REGIONS) {
      expect(conditions.filter((c) => c.region === region).length, region).toBeGreaterThanOrEqual(2)
    }
  })

  it('全行の tip に「ダミー」と書いてある', () => {
    for (const c of conditions) expect(c.tip, c.id).toContain('ダミー')
  })
})
