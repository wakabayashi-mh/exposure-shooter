import type { z } from 'zod'

export interface RowError {
  /** 元データでの行番号（1 始まり） */
  row: number
  /** 読み取れた場合の ID */
  id?: string
  messages: string[]
}

export interface ValidRow<T> {
  /** 元データでの行番号（1 始まり） */
  row: number
  value: T
}

export interface ValidationResult<T> {
  rows: ValidRow<T>[]
  errors: RowError[]
}

/**
 * 行の配列を zod スキーマで 1 行ずつ検証する。
 * 不正な行は捨てずにエラー一覧へ回し、正しい行だけを返す（インポート結果画面で一覧表示するため）。
 */
export function validateRows<S extends z.ZodType>(
  schema: S,
  input: unknown[],
  idOf: (row: unknown) => string | undefined = defaultIdOf,
): ValidationResult<z.infer<S>> {
  const rows: ValidRow<z.infer<S>>[] = []
  const errors: RowError[] = []
  input.forEach((raw, i) => {
    const parsed = schema.safeParse(raw)
    if (parsed.success) {
      rows.push({ row: i + 1, value: parsed.data })
    } else {
      errors.push({
        row: i + 1,
        id: idOf(raw),
        messages: parsed.error.issues.map((issue) =>
          issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
        ),
      })
    }
  })
  return { rows, errors }
}

function defaultIdOf(row: unknown): string | undefined {
  if (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') return row.id
  return undefined
}
