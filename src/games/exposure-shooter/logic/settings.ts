import { CONTROLS, DIFFICULTIES, EXPOSURE, FEEDBACK, KV_DIAL, type Difficulty } from './constants'

/**
 * 設定画面で変えられる値（SPEC 9 の設定）。既定値は constants.ts から作る。
 * 端末ごとに 1 つ（プロフィールごとではない）。
 */
export interface GameSettings {
  /** 許容値（SPEC 4.4） */
  tolerance: Record<Difficulty, { kvTol: number; masTolSteps: number }>
  /** 敵の速さ（時間の流れ）。1 で等速、小さいほどゆっくり */
  slowFactor: Record<Difficulty, number>
  /** 準備（ロートアップ）時間 [ms]、0.5〜2.0 秒（SPEC 7.4） */
  prepMs: number
  /** kV ダイヤルの 1 刻み（SPEC 7.3） */
  kvStep: 1 | 2 | 5
  /** 中ボタンでもパラメータを切り替える */
  middleButtonCycles: boolean
  /** キー割り当て（KeyboardEvent.code） */
  keys: Record<KeyAction, string>
  /** MISS の吹き出しを出す時間 [ms]（SPEC 7.5） */
  missBubbleMs: number
  /** 効果音の音量 0〜1 */
  volume: number
}

export type KeyAction = keyof typeof CONTROLS.keys

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  kvUp: 'kV を上げる',
  kvDown: 'kV を下げる',
  masUp: 'mAs を上げる',
  masDown: 'mAs を下げる',
  sidUp: '撮影距離を上げる',
  sidDown: '撮影距離を下げる',
  trigger: '準備 → 曝射（長押し）',
  nextTarget: '近い敵へロックオン',
}

export const PREP_RANGE_MS = { min: 500, max: 2000 }

export function defaultSettings(): GameSettings {
  const by = <T>(f: (d: (typeof DIFFICULTIES)[Difficulty]) => T) =>
    ({ beginner: f(DIFFICULTIES.beginner), standard: f(DIFFICULTIES.standard), hard: f(DIFFICULTIES.hard) }) as Record<Difficulty, T>
  return {
    tolerance: by((d) => ({ kvTol: d.kvTol, masTolSteps: d.masTolSteps })),
    slowFactor: by((d) => d.slowFactor),
    prepMs: EXPOSURE.prepMs,
    kvStep: KV_DIAL.step as 5,
    middleButtonCycles: CONTROLS.middleButtonCycles,
    keys: { ...CONTROLS.keys },
    missBubbleMs: FEEDBACK.missBubbleMs,
    volume: 0.8,
  }
}

/**
 * 保存されていた設定を既定値に重ねる。項目が増えても古い保存データで壊れないように、
 * 知らない項目は捨て、ない項目は既定値で埋め、範囲外の値は丸める。
 */
export function mergeSettings(saved: unknown): GameSettings {
  const d = defaultSettings()
  if (!saved || typeof saved !== 'object') return d
  const s = saved as Partial<GameSettings>
  const num = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
  const diffs: Difficulty[] = ['beginner', 'standard', 'hard']
  return {
    tolerance: Object.fromEntries(
      diffs.map((k) => [
        k,
        {
          kvTol: num(s.tolerance?.[k]?.kvTol, d.tolerance[k].kvTol, 0, 30),
          masTolSteps: Math.round(num(s.tolerance?.[k]?.masTolSteps, d.tolerance[k].masTolSteps, 0, 5)),
        },
      ]),
    ) as GameSettings['tolerance'],
    slowFactor: Object.fromEntries(diffs.map((k) => [k, num(s.slowFactor?.[k], d.slowFactor[k], 0.1, 1)])) as GameSettings['slowFactor'],
    prepMs: num(s.prepMs, d.prepMs, PREP_RANGE_MS.min, PREP_RANGE_MS.max),
    kvStep: s.kvStep === 1 || s.kvStep === 2 || s.kvStep === 5 ? s.kvStep : d.kvStep,
    middleButtonCycles: typeof s.middleButtonCycles === 'boolean' ? s.middleButtonCycles : d.middleButtonCycles,
    keys: Object.fromEntries(
      (Object.keys(d.keys) as KeyAction[]).map((k) => [k, typeof s.keys?.[k] === 'string' && s.keys[k] ? s.keys[k] : d.keys[k]]),
    ) as GameSettings['keys'],
    missBubbleMs: num(s.missBubbleMs, d.missBubbleMs, 500, 10000),
    volume: num(s.volume, d.volume, 0, 1),
  }
}

/** キーの表示名（KeyW → W、ArrowUp → ↑ など） */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const named: Record<string, string> = {
    Space: 'Space', Tab: 'Tab', Enter: 'Enter', ShiftLeft: '左 Shift', ShiftRight: '右 Shift',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  }
  return named[code] ?? code
}
