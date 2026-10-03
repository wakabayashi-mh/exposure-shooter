/**
 * 実機の二段スイッチ（準備 → 曝射）の状態機械（SPEC 7.4）。
 * 時間は実時間で進める（ロックオン中のスローの影響を受けない）。
 */

export type ExposurePhase = 'idle' | 'preparing' | 'ready' | 'overheat'

export interface ExposureState {
  phase: ExposurePhase
  /** 押し始めてからの時間 [ms] */
  heldMs: number
}

export interface ExposureTiming {
  prepMs: number
  overholdMs: number
}

export const EXPOSURE_IDLE: ExposureState = { phase: 'idle', heldMs: 0 }

/** ボタンを押した（準備開始）。準備中に押し直しても何もしない */
export function press(s: ExposureState): ExposureState {
  return s.phase === 'idle' ? { phase: 'preparing', heldMs: 0 } : s
}

/** 時間を進める。準備完了と管球負荷の瞬間にイベントを返す */
export function tick(
  s: ExposureState,
  dtMs: number,
  t: ExposureTiming,
): { state: ExposureState; event: 'ready' | 'overheat' | null } {
  if (s.phase === 'idle' || s.phase === 'overheat') return { state: s, event: null }
  const heldMs = s.heldMs + dtMs
  if (s.phase === 'preparing' && heldMs >= t.prepMs) {
    return { state: { phase: 'ready', heldMs }, event: 'ready' }
  }
  if (s.phase === 'ready' && heldMs >= t.prepMs + t.overholdMs) {
    return { state: { phase: 'overheat', heldMs }, event: 'overheat' }
  }
  return { state: { ...s, heldMs }, event: null }
}

/**
 * ボタンを離した。準備完了なら曝射、準備中ならキャンセル、管球負荷の後なら何もしない。
 */
export function release(s: ExposureState): { state: ExposureState; event: 'expose' | 'cancel' | null } {
  const event = s.phase === 'ready' ? 'expose' : s.phase === 'preparing' ? 'cancel' : null
  return { state: EXPOSURE_IDLE, event }
}

/** 準備ゲージの割合（0〜1） */
export function prepProgress(s: ExposureState, t: ExposureTiming): number {
  return s.phase === 'idle' ? 0 : Math.min(1, s.heldMs / t.prepMs)
}
