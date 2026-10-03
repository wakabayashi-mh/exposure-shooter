import { create } from 'zustand'
import { getStorage } from '../../core/storage'
import type { EnemyRecord } from './logic/session'

const KEY = 'exposure-shooter/defeated'

interface DexState {
  /** 一度でも撃破した撮影の id（キャラ図鑑の「撃破済みだけ表示」に使う, SPEC 9） */
  defeated: string[]
  load: () => Promise<void>
  /** プレイの記録から撃破した id を足して保存する */
  addFromRecords: (records: readonly EnemyRecord[]) => Promise<void>
}

export const useDexStore = create<DexState>((set, get) => ({
  defeated: [],

  load: async () => {
    set({ defeated: (await getStorage().get<string[]>(KEY)) ?? [] })
  },

  addFromRecords: async (records) => {
    const before = new Set(get().defeated)
    const next = new Set(before)
    for (const r of records) if (r.result === 'PERFECT' || r.result === 'GOOD') next.add(r.conditionId)
    if (next.size === before.size) return
    const defeated = [...next]
    set({ defeated })
    await getStorage().set(KEY, defeated)
  },
}))
