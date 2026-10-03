/** 撮影条件の 3 つのダイヤル（SPEC 7.3） */

export type ParamKey = 'kv' | 'mas' | 'sid'

export const PARAM_ORDER: readonly ParamKey[] = ['kv', 'mas', 'sid']

export const PARAM_LABELS: Record<ParamKey, { label: string; unit: string }> = {
  kv: { label: '管電圧', unit: 'kV' },
  mas: { label: 'mAs', unit: 'mAs' },
  sid: { label: '撮影距離', unit: 'cm' },
}

/** 右クリック・中ボタンでの切り替え（kV → mAs → 撮影距離 → kV …） */
export function nextParam(p: ParamKey): ParamKey {
  return PARAM_ORDER[(PARAM_ORDER.indexOf(p) + 1) % PARAM_ORDER.length]
}

/** kV の選択肢（min から step 刻み、max まで） */
export function kvOptions(min: number, max: number, step: number): number[] {
  const out: number[] = []
  for (let v = min; v <= max; v += step) out.push(v)
  return out
}

/** 選択肢の中で value に最も近い値 */
export function nearestOption(options: readonly number[], value: number): number {
  return options[nearestIndex(options, value)]
}

/** 1 刻み動かす。端で止める（ループしない） */
export function stepOption(options: readonly number[], value: number, dir: 1 | -1): number {
  const i = nearestIndex(options, value) + dir
  return options[Math.min(options.length - 1, Math.max(0, i))]
}

function nearestIndex(options: readonly number[], value: number): number {
  let best = 0
  for (let i = 1; i < options.length; i++) {
    if (Math.abs(options[i] - value) < Math.abs(options[best] - value)) best = i
  }
  return best
}
