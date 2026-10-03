import { SCORE } from './constants'
import type { Deviation, ExposureInput, Judgement, JudgeResult } from './judge'

/** 敵 1 体ごとの記録（SPEC 10 の学習履歴の元にもなる） */
export interface EnemyRecord {
  conditionId: string
  /** BREACH は防衛ラインへの到達（未撃破） */
  result: Judgement | 'BREACH'
  input?: ExposureInput
  deviations: Deviation[]
  /** 出現から曝射（または到達）までの時間 [ms, 実時間] */
  elapsedMs: number
  points: number
}

export interface SessionState {
  lives: number
  score: number
  /** 現在の連続撃破数 */
  combo: number
  maxCombo: number
  /** 被ばく過多の回数（SPEC 7.5） */
  overdoseCount: number
  records: EnemyRecord[]
}

export function createSession(lives: number): SessionState {
  return { lives, score: 0, combo: 0, maxCombo: 0, overdoseCount: 0, records: [] }
}

/** これまでの連続撃破数から、今回の撃破にかかる倍率（×1 から ×0.5 ずつ、上限 ×4） */
export function comboMultiplier(comboBefore: number): number {
  return Math.min(SCORE.comboMax, 1 + SCORE.comboStep * comboBefore)
}

/**
 * 撃破の得点。remainingRatio は敵の残り接近時間の割合（出現直後 1、防衛ライン 0）。
 */
export function pointsFor(result: Judgement, comboBefore: number, remainingRatio: number): number {
  if (result === 'MISS') return 0
  const base = result === 'PERFECT' ? SCORE.perfect : SCORE.good
  const early = 1 + SCORE.earlyBonusMax * Math.min(1, Math.max(0, remainingRatio))
  return Math.round(base * comboMultiplier(comboBefore) * early)
}

export interface Shot {
  conditionId: string
  judge: JudgeResult
  input: ExposureInput
  remainingRatio: number
  elapsedMs: number
}

/** 曝射の結果をセッションに反映する。撃ち直しはないので、どの結果でも記録を 1 件足す */
export function applyShot(s: SessionState, shot: Shot, missCostsLife: boolean): SessionState {
  const { result, deviations, overdose } = shot.judge
  const record: EnemyRecord = {
    conditionId: shot.conditionId,
    result,
    input: shot.input,
    deviations,
    elapsedMs: shot.elapsedMs,
    points: pointsFor(result, s.combo, shot.remainingRatio),
  }
  if (result === 'MISS') {
    return {
      ...s,
      lives: missCostsLife ? s.lives - 1 : s.lives,
      combo: 0,
      overdoseCount: s.overdoseCount + (overdose ? 1 : 0),
      records: [...s.records, record],
    }
  }
  const combo = s.combo + 1
  return {
    ...s,
    score: s.score + record.points,
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    records: [...s.records, record],
  }
}

/** 敵が防衛ラインに着いた：ライフ −1、コンボはリセット */
export function applyBreach(s: SessionState, conditionId: string, elapsedMs: number): SessionState {
  return {
    ...s,
    lives: s.lives - 1,
    combo: 0,
    records: [...s.records, { conditionId, result: 'BREACH', deviations: [], elapsedMs, points: 0 }],
  }
}
