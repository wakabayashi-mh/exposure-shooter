import { describe, expect, it } from 'vitest'
import { insertEntry, renameEntry } from '../../../core/ranking/ranking'
import { aggregate, historyRows, weakest, type PlayLog } from './historyStats'
import { compareEntries, entryFromSession, parseTableKey, tableKey, type ShooterRankEntry } from './rankingRules'
import { createSession, type EnemyRecord } from './session'
import { defaultSettings, keyLabel, mergeSettings } from './settings'
import { toleranceFor } from './modes'

const entry = (score: number, at: string, extra: Partial<ShooterRankEntry> = {}): ShooterRankEntry => ({
  id: `e${score}${at}`,
  name: 'A',
  profileId: 'p',
  at,
  score,
  kills: 0,
  accuracy: 0,
  maxCombo: 0,
  ...extra,
})

describe('ランキング', () => {
  const std = compareEntries({ mode: 'standard', difficulty: 'standard', region: 'spine' })

  it('上位 10 件だけ残し、入った順位を返す', () => {
    let entries: ShooterRankEntry[] = []
    for (let i = 1; i <= 10; i++) entries = insertEntry(entries, entry(i * 100, `2026-01-0${i % 9}`), std).entries
    const hit = insertEntry(entries, entry(550, '2026-02-01'), std)
    expect(hit.rank).toBe(6)
    expect(hit.entries).toHaveLength(10)
    expect(hit.entries.at(-1)!.score).toBe(200)
    expect(insertEntry(hit.entries, entry(50, '2026-02-02'), std).rank).toBeNull()
  })

  it('同点は先に記録したほうが上', () => {
    const first = insertEntry([], entry(500, '2026-01-01T00:00:00Z'), std).entries
    expect(insertEntry(first, entry(500, '2026-01-02T00:00:00Z'), std).rank).toBe(2)
  })

  it('ハードは撃破数 → 到達時間で並べる', () => {
    const hard = compareEntries({ mode: 'hard', difficulty: 'standard' })
    const a = entry(900, '1', { kills: 10, timeSec: 100 })
    const b = entry(100, '2', { kills: 12, timeSec: 80 })
    const c = entry(100, '3', { kills: 12, timeSec: 90 })
    const r = insertEntry(insertEntry(insertEntry([], a, hard).entries, b, hard).entries, c, hard)
    expect(r.entries.map((e) => e.id)).toEqual([c.id, b.id, a.id])
  })

  it('名前をその場で直せる', () => {
    const e = entry(100, '1')
    expect(renameEntry([e], e.id, 'B')[0].name).toBe('B')
  })

  it('表のキーは往復できる', () => {
    expect(parseTableKey(tableKey({ mode: 'standard', difficulty: 'hard', region: 'pelvis_hip' }))).toEqual({
      mode: 'standard',
      difficulty: 'hard',
      region: 'pelvis_hip',
    })
    expect(parseTableKey('hard:beginner')).toEqual({ mode: 'hard', difficulty: 'beginner' })
    expect(parseTableKey('review:standard')).toBeNull()
  })

  it('記録から正答率と撃破数を作る', () => {
    const s = { ...createSession(5), score: 700, maxCombo: 2, records: [rec('a', 'PERFECT'), rec('b', 'GOOD'), rec('c', 'MISS'), rec('d', 'BREACH')] }
    expect(entryFromSession(s, { id: 'x', name: 'A', profileId: 'p', at: '1', timeSec: 61.7 })).toMatchObject({
      score: 700,
      kills: 2,
      accuracy: 0.5,
      maxCombo: 2,
      timeSec: 61,
    })
  })
})

const rec = (id: string, result: EnemyRecord['result'], elapsedMs = 1000): EnemyRecord => ({
  conditionId: id,
  result,
  deviations: result === 'MISS' ? ['kv_high'] : [],
  elapsedMs,
  points: 0,
  ...(result === 'BREACH' ? {} : { input: { kv: 60, mas: 5, sid: 100 } }),
})
const play = (records: EnemyRecord[]): PlayLog => ({
  at: '2026-10-03T10:00:00Z',
  mode: 'standard',
  difficulty: 'standard',
  region: 'spine',
  status: 'cleared',
  score: 0,
  records,
})

describe('学習履歴の集計', () => {
  const plays = [
    play([rec('a', 'PERFECT', 2000), rec('b', 'MISS'), rec('c', 'GOOD', 4000)]),
    play([rec('a', 'GOOD', 4000), rec('b', 'BREACH'), rec('c', 'MISS'), rec('b', 'GOOD', 3000)]),
  ]
  const stats = aggregate(plays)
  const by = (id: string) => stats.find((s) => s.id === id)!

  it('撮影ごとに正答率と平均撃破時間を出す', () => {
    expect(by('a')).toMatchObject({ attempts: 2, perfect: 1, good: 1, accuracy: 1, avgKillMs: 3000 })
    expect(by('b')).toMatchObject({ attempts: 3, miss: 1, breach: 1, good: 1, avgKillMs: 3000 })
    expect(by('b').accuracy).toBeCloseTo(1 / 3)
    expect(by('c').accuracy).toBe(0.5)
  })

  it('苦手な撮影は正答率の低い順。全問正解は入れない', () => {
    expect(weakest(stats).map((s) => s.id)).toEqual(['b', 'c'])
  })

  it('書き出しは敵 1 体を 1 行にする', () => {
    const rows = historyRows(plays)
    expect(rows).toHaveLength(7)
    expect(rows[1]).toEqual(['2026-10-03T10:00:00Z', 'standard', 'standard', 'spine', 'b', 'MISS', 60, 5, 100, 'kv_high', 1])
    expect(rows[4][6]).toBe('')
  })
})

describe('設定', () => {
  it('保存データがなければ既定値', () => {
    expect(mergeSettings(undefined)).toEqual(defaultSettings())
  })

  it('範囲外の値は丸め、壊れた値は既定値に戻す', () => {
    const s = mergeSettings({ prepMs: 9999, kvStep: 3, slowFactor: { standard: 0 }, keys: { trigger: 'KeyF', kvUp: '' } })
    expect(s.prepMs).toBe(2000)
    expect(s.kvStep).toBe(5)
    expect(s.slowFactor.standard).toBe(0.1)
    expect(s.slowFactor.hard).toBe(0.8)
    expect(s.keys.trigger).toBe('KeyF')
    expect(s.keys.kvUp).toBe('KeyW')
  })

  it('許容値の設定は判定に使われる（ハードモードは常にハードの表）', () => {
    const t = { ...defaultSettings().tolerance, standard: { kvTol: 10, masTolSteps: 2 }, hard: { kvTol: 1, masTolSteps: 0 } }
    expect(toleranceFor('standard', 'standard', t)).toEqual({ kv: 10, masSteps: 2 })
    expect(toleranceFor('hard', 'standard', t)).toEqual({ kv: 1, masSteps: 0 })
  })

  it('キーの表示名', () => {
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('ArrowUp')).toBe('↑')
    expect(keyLabel('Space')).toBe('Space')
  })
})
