import { create } from 'zustand'
import type { ExposurePhase } from './logic/exposure'
import type { Condition } from './logic/master'
import { nearestOption, nextParam, stepOption, type ParamKey } from './logic/params'
import type { PlayResult } from './playConfig'

/** Phaser シーンが書き、React の HUD が読む表示用の状態 */
export interface HudState {
  status: 'idle' | 'playing' | 'cleared' | 'gameover'
  stageName: string
  modeLabel: string
  /** 上段左の時計。スタンダードは残り時間、ハードは経過時間、復習は残りの敵の数 */
  clock: { label: string; warn: boolean }
  lives: number
  maxLives: number
  score: number
  combo: number
  target: { condition: Condition; remainingSec: number; fixed: boolean } | null
  exposure: { phase: ExposurePhase; progress: number }
  toast: { text: string; id: number } | null
  /** 直前のプレイの結果（結果・復習画面と「外した部位だけ再挑戦」に使う） */
  lastResult: PlayResult | null
}

export interface DialOptions {
  kv: number[]
  mas: number[]
  sid: number[]
}

interface PlayState extends HudState {
  /** 撮影条件の現在値。敵が変わってもプレイをやり直しても保持する（SPEC 7.3） */
  params: Record<ParamKey, number>
  /** ホイールの操作対象 */
  selected: ParamKey
  options: DialOptions

  setHud: (patch: Partial<HudState>) => void
  showToast: (text: string) => void
  /** 選択肢を設定し、現在値を選択肢の中に収める。初回だけ初期値を入れる */
  setOptions: (options: DialOptions, initial: Record<ParamKey, number>) => void
  step: (key: ParamKey, dir: 1 | -1) => void
  select: (key: ParamKey) => void
  cycleSelected: () => void
}

let toastSeq = 0

export const usePlayStore = create<PlayState>((set, get) => ({
  status: 'idle',
  stageName: '',
  modeLabel: '',
  clock: { label: '', warn: false },
  lives: 0,
  maxLives: 0,
  score: 0,
  combo: 0,
  target: null,
  exposure: { phase: 'idle', progress: 0 },
  toast: null,
  lastResult: null,

  params: { kv: Number.NaN, mas: Number.NaN, sid: Number.NaN },
  selected: 'kv',
  options: { kv: [], mas: [], sid: [] },

  setHud: (patch) => set(patch),
  showToast: (text) => set({ toast: { text, id: ++toastSeq } }),

  setOptions: (options, initial) => {
    const prev = get().params
    const fit = (k: ParamKey) => nearestOption(options[k], Number.isNaN(prev[k]) ? initial[k] : prev[k])
    set({ options, params: { kv: fit('kv'), mas: fit('mas'), sid: fit('sid') } })
  },
  step: (key, dir) => {
    const { params, options } = get()
    set({ params: { ...params, [key]: stepOption(options[key], params[key], dir) } })
  },
  select: (key) => set({ selected: key }),
  cycleSelected: () => set({ selected: nextParam(get().selected) }),
}))
