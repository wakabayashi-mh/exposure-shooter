import type { Condition } from './master'

export type Judgement = 'PERFECT' | 'GOOD' | 'MISS'
export type Deviation = 'kv_high' | 'kv_low' | 'mas_low' | 'mas_high' | 'sid'

export interface ExposureInput {
  kv: number
  mas: number
  sid: number
}

export interface Tolerance {
  kv: number
  masSteps: number
}

export interface JudgeResult {
  result: Judgement
  /** 許容範囲を外れたずれ（MISS のときだけ中身がある） */
  deviations: Deviation[]
  /** 線量が過剰になる方向のミス（kV 高すぎ・mAs 過剰）か */
  overdose: boolean
}

/** ずれの表示（SPEC 7.5） */
export const DEVIATION_LABELS: Record<Deviation, string> = {
  kv_high: 'kV 高すぎ → コントラスト低下',
  kv_low: 'kV 低すぎ → 透過不足',
  mas_low: 'mAs 不足 → ノイズ増加',
  mas_high: 'mAs 過剰 → 被ばく過多',
  sid: '撮影距離が違う → 拡大率・線量が変わる',
}

/** 行ごとの許容値の上書きがあればそちらを使う（SPEC 4.4） */
export function resolveTolerance(c: Condition, base: Tolerance): Tolerance {
  return { kv: c.kv_tol ?? base.kv, masSteps: c.mas_tol_steps ?? base.masSteps }
}

/** mAs 系列上での段数差（入力 − 正解）。系列にない値は、その値より小さい段の数を位置として扱う */
export function masStepDiff(series: readonly number[], input: number, correct: number): number {
  return position(series, input) - position(series, correct)
}

function position(series: readonly number[], value: number): number {
  const i = series.indexOf(value)
  return i >= 0 ? i : series.filter((v) => v < value).length - 0.5
}

/** 3 つのパラメータを判定する（SPEC 7.5）。グリッドは判定に使わない */
export function judge(
  c: Condition,
  input: ExposureInput,
  tol: Tolerance,
  masSeries: readonly number[],
): JudgeResult {
  const dKv = input.kv - c.kv
  const dMas = masStepDiff(masSeries, input.mas, c.mas)

  if (dKv === 0 && dMas === 0 && input.sid === c.sid) {
    return { result: 'PERFECT', deviations: [], overdose: false }
  }

  const deviations: Deviation[] = []
  if (dKv > tol.kv) deviations.push('kv_high')
  if (dKv < -tol.kv) deviations.push('kv_low')
  if (dMas < -tol.masSteps) deviations.push('mas_low')
  if (dMas > tol.masSteps) deviations.push('mas_high')
  if (input.sid !== c.sid) deviations.push('sid')

  if (deviations.length === 0) return { result: 'GOOD', deviations, overdose: false }
  return {
    result: 'MISS',
    deviations,
    overdose: deviations.includes('kv_high') || deviations.includes('mas_high'),
  }
}
