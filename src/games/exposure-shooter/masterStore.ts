import { create } from 'zustand'
import type { RowError } from '../../core/data/validateRows'
import { getStorage } from '../../core/storage'
import sample from '../../../data/conditions.sample.json'
import { parseMaster, type Condition } from './logic/master'
import { buildMasSeries, type MasSeries } from './logic/masSeries'
import { buildSidOptions, type SidOptions } from './logic/sidOptions'

export const MASTER_KEY = 'exposure-shooter/master'

interface MasterState {
  status: 'idle' | 'loading' | 'ready'
  /** 現在のマスタがどこから来たか */
  source: 'saved' | 'sample' | null
  conditions: Condition[]
  errors: RowError[]
  mas: MasSeries
  sid: SidOptions
  /** 保存済みのマスタを読む。なければサンプルを読み込んで保存する */
  load: () => Promise<void>
  /** サンプルマスタで置き換えて保存する */
  loadSample: () => Promise<void>
}

/** 行データからマスタと派生値（mAs 系列・撮影距離の選択肢）をまとめて作り直す */
function derive(raw: unknown) {
  const { conditions, errors } = parseMaster(raw)
  return { conditions, errors, mas: buildMasSeries(conditions), sid: buildSidOptions(conditions) }
}

export const useMasterStore = create<MasterState>((set) => ({
  status: 'idle',
  source: null,
  ...derive([]),

  load: async () => {
    set({ status: 'loading' })
    const saved = await getStorage().get<unknown>(MASTER_KEY)
    if (saved === undefined) {
      await getStorage().set(MASTER_KEY, sample)
      set({ status: 'ready', source: 'sample', ...derive(sample) })
    } else {
      set({ status: 'ready', source: 'saved', ...derive(saved) })
    }
  },

  loadSample: async () => {
    await getStorage().set(MASTER_KEY, sample)
    set({ status: 'ready', source: 'sample', ...derive(sample) })
  },
}))
