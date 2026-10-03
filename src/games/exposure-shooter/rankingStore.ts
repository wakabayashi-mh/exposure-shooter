import { create } from 'zustand'
import type { Profile } from '../../core/profile/profileStore'
import { insertEntry, renameEntry } from '../../core/ranking/ranking'
import { getStorage } from '../../core/storage'
import { compareEntries, entryFromSession, parseTableKey, tableKey, type RankTable, type ShooterRankEntry } from './logic/rankingRules'
import type { PlayConfig, PlayResult } from './playConfig'

const KEY = 'exposure-shooter/ranking'

/** 結果画面で使う、今回のランクイン */
export interface RankIn {
  tableKey: string
  entryId: string
  rank: number
}

interface RankingState {
  tables: Record<string, ShooterRankEntry[]>
  load: () => Promise<void>
  /** 結果を記録する。ランクインしたら順位を返す（復習モードは記録しない） */
  submit: (result: PlayResult, profile: Profile) => Promise<RankIn | null>
  rename: (tableKey: string, entryId: string, name: string) => Promise<void>
  /** key を省くと全部消す */
  reset: (tableKey?: string) => Promise<void>
}

export function rankTableOf(config: PlayConfig): RankTable | null {
  if (config.mode === 'standard') return { mode: 'standard', difficulty: config.difficulty, region: config.region }
  if (config.mode === 'hard') return { mode: 'hard', difficulty: config.difficulty }
  return null
}

export const useRankingStore = create<RankingState>((set, get) => {
  const save = async (tables: Record<string, ShooterRankEntry[]>) => {
    set({ tables })
    await getStorage().set(KEY, tables)
  }
  return {
    tables: {},

    load: async () => {
      const saved = (await getStorage().get<Record<string, ShooterRankEntry[]>>(KEY)) ?? {}
      // 読めない表（キーの形が変わったものなど）は捨てる
      set({ tables: Object.fromEntries(Object.entries(saved).filter(([k]) => parseTableKey(k))) })
    },

    submit: async (result, profile) => {
      const table = rankTableOf(result.config)
      if (!table || result.session.records.length === 0) return null
      const key = tableKey(table)
      const entry = entryFromSession(result.session, {
        id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: profile.name,
        profileId: profile.id,
        at: new Date().toISOString(),
        timeSec: table.mode === 'hard' ? result.elapsedSec : undefined,
      })
      const { entries, rank } = insertEntry(get().tables[key] ?? [], entry, compareEntries(table))
      await save({ ...get().tables, [key]: entries })
      return rank ? { tableKey: key, entryId: entry.id, rank } : null
    },

    rename: async (key, entryId, name) => {
      const entries = get().tables[key]
      if (entries) await save({ ...get().tables, [key]: renameEntry(entries, entryId, name) })
    },

    reset: async (key) => {
      if (!key) return save({})
      const { [key]: _removed, ...rest } = get().tables
      await save(rest)
    },
  }
})
