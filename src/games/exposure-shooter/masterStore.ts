import { create } from 'zustand'
import type { RowError } from '../../core/data/validateRows'
import { getStorage } from '../../core/storage'
import sample from '../../../data/conditions.sample.json'
import { parseMaster, type Condition } from './logic/master'
import { buildMasSeries, type MasSeries } from './logic/masSeries'
import { buildSidOptions, type SidOptions } from './logic/sidOptions'

export const MASTER_KEY = 'exposure-shooter/master'
/**
 * 保存中のマスタがどの版のサンプルか。施設の条件表を取り込んだら 'imported' にする（フェーズ 5）。
 * サンプルを書き換えて配り直したとき、古いサンプルを保存している端末も新しいサンプルに入れ替えるために使う。
 */
const SAMPLE_VERSION_KEY = 'exposure-shooter/master-sample-version'
const SAMPLE_VERSION = hashOf(JSON.stringify(sample))

function hashOf(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}

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
  /** 編集・取り込みしたマスタを保存する（以後サンプルの入れ替えはしない） */
  save: (rows: unknown[]) => Promise<void>
}

/** 行データからマスタと派生値（mAs 系列・撮影距離の選択肢）をまとめて作り直す */
function derive(raw: unknown) {
  const { conditions, errors } = parseMaster(raw)
  return { conditions, errors, mas: buildMasSeries(conditions), sid: buildSidOptions(conditions) }
}

export const useMasterStore = create<MasterState>((set, get) => ({
  status: 'idle',
  source: null,
  ...derive([]),

  load: async () => {
    set({ status: 'loading' })
    const storage = getStorage()
    const saved = await storage.get<unknown>(MASTER_KEY)
    const version = await storage.get<string>(SAMPLE_VERSION_KEY)
    // 未保存、または古い版のサンプルのままなら今のサンプルに入れ替える（版の記録がない = 取り込み機能より前のサンプル）
    if (saved === undefined || (version !== 'imported' && version !== SAMPLE_VERSION)) {
      await get().loadSample()
    } else {
      set({ status: 'ready', source: 'saved', ...derive(saved) })
    }
  },

  save: async (rows) => {
    await getStorage().set(MASTER_KEY, rows)
    await getStorage().set(SAMPLE_VERSION_KEY, 'imported')
    set({ status: 'ready', source: 'saved', ...derive(rows) })
  },

  loadSample: async () => {
    await getStorage().set(MASTER_KEY, sample)
    await getStorage().set(SAMPLE_VERSION_KEY, SAMPLE_VERSION)
    set({ status: 'ready', source: 'sample', ...derive(sample) })
  },
}))
