import { DIFFICULTIES, MODES, type Difficulty } from './logic/constants'
import { REGION_LABELS, type Condition, type Region } from './logic/master'
import type { SessionState } from './logic/session'
import { stagePool } from './logic/spawn'

/** 何を遊ぶか（モード選択・ステージ選択・結果画面の再挑戦から作る） */
export type PlayConfig =
  | { mode: 'standard'; difficulty: Difficulty; region: Region }
  | { mode: 'hard'; difficulty: Difficulty }
  /** 復習：直前のプレイで外した部位だけ（SPEC 6.3）。region は戻り先のステージ選択用 */
  | { mode: 'review'; difficulty: Difficulty; ids: string[]; region?: Region }

/** 1 プレイの結果（結果・復習画面に渡す） */
export interface PlayResult {
  config: PlayConfig
  status: 'cleared' | 'gameover'
  session: SessionState
  /** 実時間の経過 [秒]。ハードモードでは到達時間 */
  elapsedSec: number
  /** 記録の id から部位を引くための条件（プレイ時点のマスタ） */
  conditions: Condition[]
}

export function stageName(config: PlayConfig): string {
  switch (config.mode) {
    case 'standard':
      return REGION_LABELS[config.region]
    case 'hard':
      return '全部位'
    case 'review':
      return `外した部位（${config.ids.length}）`
  }
}

export function modeLabel(config: PlayConfig): string {
  return `${MODES[config.mode].label}／難易度 ${DIFFICULTIES[config.difficulty].label}`
}

/** そのプレイに出す敵の候補 */
export function buildPool(config: PlayConfig, conditions: readonly Condition[]): Condition[] {
  switch (config.mode) {
    case 'standard':
      return stagePool(conditions, config.region)
    case 'hard':
      return [...conditions]
    case 'review': {
      const byId = new Map(conditions.map((c) => [c.id, c]))
      return config.ids.map((id) => byId.get(id)).filter((c): c is Condition => !!c)
    }
  }
}
