import { describe, expect, it } from 'vitest'
import { convertRows, detectHeaderRow, guessMapping, knownId, letters, toFrequency, toGrid, toNumber, toRegion } from './importMapping'
import { parseMaster } from './master'

describe('guessMapping', () => {
  it('日本語の見出しから列を推測する（単位の括弧や全角も受け付ける）', () => {
    const m = guessMapping(['部位', '撮影方向', '体位', '管電圧(kV)', 'ｍＡｓ', '撮影距離［cm］', 'グリッド', '備考'])
    expect(m).toMatchObject({ part: 0, view: 1, position: 2, kv: 3, mas: 4, sid: 5, grid: 6, tip: 7, region: null, id: null })
  })

  it('英語のキー（エクスポートした CSV）はそのまま対応する', () => {
    const m = guessMapping(['id', 'region', 'part', 'view', 'kv', 'mas', 'sid', 'frequency', 'character', 'tip', 'kv_tol', 'mas_tol_steps'])
    expect(m).toMatchObject({ id: 0, region: 1, part: 2, view: 3, kv: 4, mas: 5, sid: 6, frequency: 7, character: 8, tip: 9, kv_tol: 10, mas_tol_steps: 11 })
  })

  it('1 つの列は 1 項目にだけ使う（mAs と mAs 許容を取り違えない）', () => {
    const m = guessMapping(['mas_tol_steps', 'mas'])
    expect(m.mas).toBe(1)
    expect(m.mas_tol_steps).toBe(0)
  })
})

describe('値の変換', () => {
  it('数値：小数点のカンマ、単位、全角を直す。読めなければ文字列のまま', () => {
    expect(toNumber('3,2')).toBe(3.2)
    expect(toNumber('120kV')).toBe(120)
    expect(toNumber('２００ cm')).toBe(200)
    expect(toNumber(40)).toBe(40)
    expect(toNumber('')).toBeUndefined()
    expect(toNumber('高め')).toBe('高め')
  })

  it('分類：日本語名を受け付け、空なら部位から推測する', () => {
    expect(toRegion('胸腹部', '')).toBe('chest_abdomen')
    expect(toRegion('下肢', '')).toBe('lower_limb')
    expect(toRegion(undefined, '頸椎')).toBe('spine')
    expect(toRegion(undefined, '股関節')).toBe('pelvis_hip')
    expect(toRegion(undefined, '手関節')).toBe('upper_limb')
    expect(toRegion(undefined, '膝関節')).toBe('lower_limb')
    expect(toRegion(undefined, '副鼻腔')).toBe('head_neck')
    expect(toRegion(undefined, '肋骨')).toBe('chest_abdomen')
  })

  it('頻度：高中低や記号を受け付け、空なら中', () => {
    expect(toFrequency('高')).toBe('high')
    expect(toFrequency('△')).toBe('low')
    expect(toFrequency(undefined)).toBe('mid')
  })

  it('グリッド：あり / なし', () => {
    expect(toGrid('あり')).toBe(true)
    expect(toGrid('×')).toBe(false)
    expect(toGrid(undefined)).toBeUndefined()
  })

  it('既知の撮影は部位と方向からキャラのある id を使う', () => {
    expect(knownId('胸部', '正面（PA）')).toBe('chest_pa')
    expect(knownId('頸椎', '開口位')).toBe('c_spine_open_mouth')
    expect(knownId('手', '正面')).toBe('hand_pa')
    expect(knownId('手関節', '正面')).toBeUndefined()
  })

  it('連番は英小文字で作る', () => {
    expect([0, 1, 25, 26, 27].map(letters)).toEqual(['a', 'b', 'z', 'ba', 'bb'])
  })
})

describe('convertRows → parseMaster', () => {
  it('ID も分類もない施設の表を、検証を通るマスタにする', () => {
    const headers = ['部位', '方向', '体位', '管電圧', 'mAs', '距離', '備考']
    const rows = [
      ['胸部', '正面（PA）', '立位', 120, '3,2', 200, ''],
      ['胸部', '側面', '立位', '130kV', 5, '200cm', '両腕挙上'],
      ['肩関節', 'Y ビュー', '立位', 70, 10, 100, ''],
      ['肩関節', '正面', '立位', 65, 8, 100, ''],
    ]
    const raw = convertRows(rows, guessMapping(headers))
    const { conditions, errors } = parseMaster(raw)
    expect(errors).toEqual([])
    expect(conditions.map((c) => c.id)).toEqual(['chest_pa', 'chest_lat', 'custom_a', 'custom_b'])
    expect(conditions[0]).toMatchObject({ region: 'chest_abdomen', kv: 120, mas: 3.2, sid: 200, frequency: 'mid', character: 'chest_pa' })
    expect(conditions[1].tip).toBe('両腕挙上')
    expect(conditions[0].tip).toBeUndefined()
    expect(conditions[2].region).toBe('upper_limb')
  })

  it('同じ撮影が 2 行あれば 2 行目は別の id にする（キャラは 1 行目だけ）', () => {
    const raw = convertRows(
      [
        ['胸部', '正面', 120, 3.2, 200],
        ['胸部', '正面', 110, 2.5, 180],
      ],
      guessMapping(['部位', '方向', 'kV', 'mAs', 'SID']),
    )
    expect(raw.map((r) => r.id)).toEqual(['chest_pa', 'custom_a'])
  })

  it('読めない値は検証エラーになり、行番号で分かる', () => {
    const raw = convertRows([['胸部', '正面', '高め', 3.2, 200]], guessMapping(['部位', '方向', 'kV', 'mAs', 'SID']))
    const { errors } = parseMaster(raw)
    expect(errors[0].row).toBe(1)
    expect(errors[0].messages.some((m) => m.startsWith('kv'))).toBe(true)
  })
})

describe('detectHeaderRow', () => {
  it('表の上のタイトル行を飛ばして見出しの行を選ぶ', () => {
    const grid = [['○○病院 一般撮影条件表'], ['2026 年 4 月改訂'], ['部位', '方向', 'kV', 'mAs', '距離'], ['胸部', '正面', 120, 3.2, 200]]
    expect(detectHeaderRow(grid)).toBe(2)
  })
  it('見出しらしい行がなければ 1 行目', () => {
    expect(detectHeaderRow([['a', 'b'], ['c', 'd']])).toBe(0)
  })
})
