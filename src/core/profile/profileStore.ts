import { create } from 'zustand'
import { getStorage } from '../storage'

/**
 * ローカルのプロフィール（名前だけ、パスワードなし, SPEC 10）。
 * 勉強会で 1 台を回して使うため、シリーズの全ゲームで共通にする。
 */
export interface Profile {
  id: string
  name: string
}

const KEY = 'core/profiles'
const DEFAULT_NAME = 'ゲスト'

interface Saved {
  profiles: Profile[]
  currentId: string
}

interface ProfileState extends Saved {
  ready: boolean
  load: () => Promise<void>
  select: (id: string) => Promise<void>
  /** 追加して、そのプロフィールに切り替える */
  add: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  /** 削除する（最後の 1 人は消せない）。ランキングの記録は名前ごと残る */
  remove: (id: string) => Promise<void>
}

const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const cleanName = (name: string) => name.trim().slice(0, 16) || DEFAULT_NAME

export const useProfileStore = create<ProfileState>((set, get) => {
  const save = async (next: Saved) => {
    set(next)
    await getStorage().set<Saved>(KEY, next)
  }
  return {
    profiles: [],
    currentId: '',
    ready: false,

    load: async () => {
      const saved = await getStorage().get<Saved>(KEY)
      if (saved && saved.profiles.length > 0) {
        const currentId = saved.profiles.some((p) => p.id === saved.currentId) ? saved.currentId : saved.profiles[0].id
        set({ profiles: saved.profiles, currentId, ready: true })
      } else {
        const guest = { id: newId(), name: DEFAULT_NAME }
        await save({ profiles: [guest], currentId: guest.id })
        set({ ready: true })
      }
    },

    select: async (id) => {
      if (get().profiles.some((p) => p.id === id)) await save({ profiles: get().profiles, currentId: id })
    },

    add: async (name) => {
      const p = { id: newId(), name: cleanName(name) }
      await save({ profiles: [...get().profiles, p], currentId: p.id })
    },

    rename: async (id, name) => {
      await save({
        profiles: get().profiles.map((p) => (p.id === id ? { ...p, name: cleanName(name) } : p)),
        currentId: get().currentId,
      })
    },

    remove: async (id) => {
      const profiles = get().profiles.filter((p) => p.id !== id)
      if (profiles.length === 0) return
      await save({ profiles, currentId: get().currentId === id ? profiles[0].id : get().currentId })
    },
  }
})

/** 今のプロフィール（読み込み前は仮のゲスト） */
export function currentProfile(): Profile {
  const { profiles, currentId } = useProfileStore.getState()
  return profiles.find((p) => p.id === currentId) ?? { id: 'guest', name: DEFAULT_NAME }
}
