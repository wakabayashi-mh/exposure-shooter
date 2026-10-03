import { create } from 'zustand'
import { getStorage } from '../../core/storage'
import type { Difficulty } from './logic/constants'
import type { Region } from './logic/master'
import type { PlayConfig, PlayResult } from './playConfig'

/**
 * ステージごとのベスト記録（ステージ選択画面の表示用）。
 * フェーズ 5 のハイスコアランキング（SPEC 10.1）ができたら、そちらから引くように置き換える。
 */
export interface BestRecord {
  score: number
  cleared: boolean
  kills: number
  maxCombo: number
  /** ハードモードの到達時間 [秒] */
  timeSec: number
}

const KEY = 'exposure-shooter/best'

export function standardKey(difficulty: Difficulty, region: Region) {
  return `standard:${difficulty}:${region}`
}

export function hardKey(difficulty: Difficulty) {
  return `hard:${difficulty}`
}

/** 復習モードは記録しない */
function keyOf(config: PlayConfig): string | null {
  if (config.mode === 'standard') return standardKey(config.difficulty, config.region)
  if (config.mode === 'hard') return hardKey(config.difficulty)
  return null
}

function killsOf(r: PlayResult) {
  return r.session.records.filter((x) => x.result === 'PERFECT' || x.result === 'GOOD').length
}

/** 新しい記録が前のベストより良いか。ハードは撃破数→到達時間、スタンダードはスコア */
function isBetter(next: BestRecord, prev: BestRecord | undefined, hard: boolean) {
  if (!prev) return true
  if (hard) return next.kills > prev.kills || (next.kills === prev.kills && next.timeSec > prev.timeSec)
  return next.score > prev.score
}

interface BestState {
  records: Record<string, BestRecord>
  load: () => Promise<void>
  /** 結果を反映して保存する。ベストを更新したら true */
  submit: (result: PlayResult) => Promise<boolean>
}

export const useBestStore = create<BestState>((set, get) => ({
  records: {},

  load: async () => {
    set({ records: (await getStorage().get<Record<string, BestRecord>>(KEY)) ?? {} })
  },

  submit: async (result) => {
    const key = keyOf(result.config)
    if (!key) return false
    const prev = get().records[key]
    const next: BestRecord = {
      score: result.session.score,
      cleared: result.status === 'cleared',
      kills: killsOf(result),
      maxCombo: result.session.maxCombo,
      timeSec: Math.floor(result.elapsedSec),
    }
    const better = isBetter(next, prev, result.config.mode === 'hard')
    // クリア済みは一度付いたら消さない
    const merged = better ? { ...next, cleared: next.cleared || !!prev?.cleared } : { ...prev!, cleared: prev!.cleared || next.cleared }
    const records = { ...get().records, [key]: merged }
    set({ records })
    await getStorage().set(KEY, records)
    return better
  },
}))
