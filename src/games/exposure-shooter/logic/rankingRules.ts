import type { RankEntry } from '../../../core/ranking/ranking'
import { DIFFICULTIES, MODES, type Difficulty } from './constants'
import { REGION_LABELS, REGIONS, type Region } from './master'
import type { SessionState } from './session'

/** ハイスコアの 1 件（SPEC 10.1：順位、名前、スコア、撃破数、正答率、最高コンボ、日付。ハードは到達時間も） */
export interface ShooterRankEntry extends RankEntry {
  score: number
  kills: number
  /** 正答率（撃破 ÷ 出てきた敵） 0〜1 */
  accuracy: number
  maxCombo: number
  /** ハードモードの到達時間 [秒] */
  timeSec?: number
}

/** ランキングの表：モード × ステージ × 難易度。ハードは難易度ごとに 1 つ。復習は記録しない */
export type RankTable =
  | { mode: 'standard'; difficulty: Difficulty; region: Region }
  | { mode: 'hard'; difficulty: Difficulty }

export function tableKey(t: RankTable): string {
  return t.mode === 'standard' ? `standard:${t.difficulty}:${t.region}` : `hard:${t.difficulty}`
}

export function parseTableKey(key: string): RankTable | null {
  const [mode, difficulty, region] = key.split(':')
  if (!(difficulty in DIFFICULTIES)) return null
  if (mode === 'hard') return { mode, difficulty: difficulty as Difficulty }
  if (mode === 'standard' && (REGIONS as readonly string[]).includes(region)) {
    return { mode, difficulty: difficulty as Difficulty, region: region as Region }
  }
  return null
}

export function tableLabel(t: RankTable): string {
  const d = DIFFICULTIES[t.difficulty].label
  return t.mode === 'hard' ? `${MODES.hard.label}／${d}` : `${REGION_LABELS[t.region]}／${d}`
}

/** すべての表（表示順：スタンダードの各ステージ、ハード。それぞれ難易度順） */
export function allTables(): RankTable[] {
  const diffs = Object.keys(DIFFICULTIES) as Difficulty[]
  return [
    ...REGIONS.flatMap((region) => diffs.map((difficulty) => ({ mode: 'standard' as const, difficulty, region }))),
    ...diffs.map((difficulty) => ({ mode: 'hard' as const, difficulty })),
  ]
}

/** 並び順。スタンダードはスコア、ハードは撃破数 → 到達時間 → スコア */
export function compareEntries(t: RankTable) {
  return (a: ShooterRankEntry, b: ShooterRankEntry) =>
    t.mode === 'hard'
      ? b.kills - a.kills || (b.timeSec ?? 0) - (a.timeSec ?? 0) || b.score - a.score
      : b.score - a.score
}

export function entryFromSession(
  s: SessionState,
  info: { id: string; name: string; profileId: string; at: string; timeSec?: number },
): ShooterRankEntry {
  const kills = s.records.filter((r) => r.result === 'PERFECT' || r.result === 'GOOD').length
  return {
    ...info,
    score: s.score,
    kills,
    accuracy: s.records.length > 0 ? kills / s.records.length : 0,
    maxCombo: s.maxCombo,
    ...(info.timeSec !== undefined ? { timeSec: Math.floor(info.timeSec) } : {}),
  }
}
