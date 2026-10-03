import { z } from 'zod'
import { validateRows, type RowError } from '../../../core/data/validateRows'

/** ステージ振り分け用の大分類（SPEC 4.1）。並び順はスタンダードモードのステージ順 */
export const REGIONS = [
  'chest_abdomen',
  'spine',
  'upper_limb',
  'lower_limb',
  'head_neck',
  'pelvis_hip',
] as const
export type Region = (typeof REGIONS)[number]

export const REGION_LABELS: Record<Region, string> = {
  chest_abdomen: '胸腹部',
  spine: '脊椎',
  upper_limb: '上肢',
  lower_limb: '下肢',
  head_neck: '頭頸部',
  pelvis_hip: '骨盤・股関節',
}

export const FREQUENCIES = ['high', 'mid', 'low'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const FREQUENCY_LABELS: Record<Frequency, string> = { high: '高', mid: '中', low: '低' }

/** 撮影条件マスタ 1 行（SPEC 4.1） */
export const conditionSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/, '英小文字とアンダースコアだけで書いてください'),
  region: z.enum(REGIONS),
  part: z.string().min(1),
  view: z.string().min(1),
  position: z.string().optional(),
  kv: z.number().positive(),
  mas: z.number().positive(),
  sid: z.number().positive(),
  /** データとして保持するだけで、判定には使わない */
  grid: z.boolean().optional(),
  frequency: z.enum(FREQUENCIES),
  character: z.string().min(1),
  tip: z.string().optional(),
  kv_tol: z.number().nonnegative().optional(),
  mas_tol_steps: z.number().int().nonnegative().optional(),
})
export type Condition = z.infer<typeof conditionSchema>

export interface MasterParseResult {
  conditions: Condition[]
  errors: RowError[]
}

/**
 * マスタ（JSON の配列）を検証する。スキーマ違反の行と、ID が重複した 2 行目以降はエラーに回す。
 */
export function parseMaster(input: unknown): MasterParseResult {
  if (!Array.isArray(input)) {
    return { conditions: [], errors: [{ row: 0, messages: ['マスタは行の配列である必要があります'] }] }
  }
  const { rows, errors } = validateRows(conditionSchema, input)

  const seen = new Set<string>()
  const conditions: Condition[] = []
  for (const { row, value } of rows) {
    if (seen.has(value.id)) {
      errors.push({ row, id: value.id, messages: [`id "${value.id}" が重複しています`] })
      continue
    }
    seen.add(value.id)
    conditions.push(value)
  }
  errors.sort((a, b) => a.row - b.row)
  return { conditions, errors }
}
