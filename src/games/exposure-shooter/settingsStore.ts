import { create } from 'zustand'
import { getStorage } from '../../core/storage'
import { defaultSettings, mergeSettings, type GameSettings } from './logic/settings'

const KEY = 'exposure-shooter/settings'

interface SettingsState {
  settings: GameSettings
  load: () => Promise<void>
  update: (patch: Partial<GameSettings>) => Promise<void>
  reset: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings(),

  load: async () => {
    set({ settings: mergeSettings(await getStorage().get(KEY)) })
  },

  update: async (patch) => {
    const settings = mergeSettings({ ...get().settings, ...patch })
    set({ settings })
    await getStorage().set(KEY, settings)
  },

  reset: async () => {
    set({ settings: defaultSettings() })
    await getStorage().remove(KEY)
  },
}))
