/**
 * ゲームの調整値はすべてここに置く（SPEC 7.6）。
 * 設定画面（フェーズ 5）で変えられるものも、既定値はここから取る。
 */

export type Difficulty = 'beginner' | 'standard' | 'hard'

export interface DifficultyConfig {
  label: string
  /** kV 許容 [±kV]（SPEC 4.4） */
  kvTol: number
  /** mAs 許容 [±段] */
  masTolSteps: number
  /** ロックオン中の時間の流れ（SPEC 7.2） */
  slowFactor: number
  /** ライフ（SPEC 7.7） */
  lives: number
  /** MISS でライフを減らすか（ビギナーだけ減らさない, SPEC 7.5） */
  missCostsLife: boolean
  /** 同時に出る敵の上限（SPEC 7.1） */
  maxEnemies: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  beginner: { label: 'ビギナー', kvTol: 5, masTolSteps: 1, slowFactor: 0.35, lives: 4, missCostsLife: false, maxEnemies: 3 },
  standard: { label: 'スタンダード', kvTol: 5, masTolSteps: 1, slowFactor: 0.5, lives: 5, missCostsLife: true, maxEnemies: 3 },
  hard: { label: 'ハード', kvTol: 2, masTolSteps: 0, slowFactor: 0.8, lives: 3, missCostsLife: true, maxEnemies: 5 },
}

/** スコア（SPEC 7.6） */
export const SCORE = {
  perfect: 300,
  good: 100,
  /** 連続撃破ごとのコンボ倍率の上がり幅 */
  comboStep: 0.5,
  comboMax: 4,
  /** 早撃ちボーナスの最大（敵の残り接近時間に比例） */
  earlyBonusMax: 0.5,
}

/** 曝射スイッチ（SPEC 7.4） */
export const EXPOSURE = {
  /** 準備（ロートアップ）にかかる時間 */
  prepMs: 1000,
  /** 準備完了からこの時間離さないと管球負荷で準備を解除する */
  overholdMs: 5000,
}

/** 管電圧ダイヤル（SPEC 7.3） */
export const KV_DIAL = { min: 40, max: 150, step: 5, initial: 70 }
/** mAs ダイヤルの初期値（系列で最も近い値に合わせる） */
export const MAS_INITIAL = 10

/** スタンダードモードのステージ（未決事項: 遊びながら調整する） */
export const STAGE = {
  /** ステージの長さ [秒, 実時間] */
  durationSec: 150,
  /** 敵が奥から防衛ラインに着くまで [秒, ゲーム内時間] */
  approachSec: 10,
  /** 出現間隔 [秒, ゲーム内時間] */
  spawnIntervalSec: 3.2,
  firstSpawnSec: 1,
  /** ステージのこの割合を過ぎたら low を混ぜる */
  lowFromRatio: 0.7,
  /** 終盤に混ぜる low の数（この範囲でランダム） */
  lowCountMin: 1,
  lowCountMax: 2,
}

/** 出現の重み（SPEC 6.1: high / mid を中心にする） */
export const FREQUENCY_WEIGHT = { high: 3, mid: 2 } as const

export const FEEDBACK = {
  /** MISS の吹き出しを出す時間（SPEC 7.5） */
  missBubbleMs: 2500,
  /** 「準備未完了」などの短い表示 */
  toastMs: 1200,
}

/** 操作（SPEC 7.3）。キー割り当ては設定画面（フェーズ 5）で変えられるようにする */
export const CONTROLS = {
  /** 中ボタンでもパラメータを切り替える */
  middleButtonCycles: true,
  keys: {
    kvUp: 'KeyW',
    kvDown: 'KeyS',
    masUp: 'KeyD',
    masDown: 'KeyA',
    sidUp: 'KeyE',
    sidDown: 'KeyQ',
    trigger: 'Space',
    nextTarget: 'Tab',
  },
}
