import * as XLSX from 'xlsx'

export type TableCell = string | number | boolean

/** 表のファイルを読んだ結果。シートごとに、見出しの行とその下の行を持つ */
export interface TableSheet {
  name: string
  /** 空でない行すべて（見出しの行を選び直すときに使う） */
  grid: TableCell[][]
  /** grid の中で見出しにしている行 */
  headerIndex: number
  headers: string[]
  /** 見出しの下の行。セルは文字列か数値か真偽値 */
  rows: TableCell[][]
}

/** 見出しの行を選び直す（表の上にタイトル行がある Excel のため） */
export function withHeaderRow(sheet: TableSheet, headerIndex: number): TableSheet {
  const i = Math.max(0, Math.min(sheet.grid.length - 1, headerIndex))
  return {
    ...sheet,
    headerIndex: i,
    headers: (sheet.grid[i] ?? []).map((h) => String(h).trim()),
    rows: sheet.grid.slice(i + 1),
  }
}

/**
 * .xlsx / .xls / .csv / .json を読み、シートの一覧にする（SPEC 4.5 のインポート）。
 * CSV は UTF-8 で読めなければ Shift_JIS として読む（Excel で保存した日本語の CSV のため）。
 */
export async function readTableFile(file: File): Promise<TableSheet[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) return [jsonSheet(JSON.parse(await file.text()), file.name)]

  const workbook = name.endsWith('.csv')
    ? XLSX.read(decodeText(await file.arrayBuffer()), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })

  return workbook.SheetNames.map((sheetName) => {
    const grid = XLSX.utils
      .sheet_to_json<TableCell[]>(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false })
      .filter((r) => r.some((c) => String(c).trim() !== ''))
    // ひとまず最初の行を見出しにする（どの行が見出しかは呼び出し側で選び直せる）
    return withHeaderRow({ name: sheetName, grid, headerIndex: 0, headers: [], rows: [] }, 0)
  })
}

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('shift_jis').decode(buf)
  }
}

/** JSON（オブジェクトの配列）を表にする。見出しは全行のキーの和 */
export function jsonSheet(data: unknown, name = 'JSON'): TableSheet {
  if (!Array.isArray(data)) throw new Error('JSON は行（オブジェクト）の配列にしてください')
  const headers = [...new Set(data.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : [])))]
  const rows = data.map((r) =>
    headers.map((h) => {
      const v = (r as Record<string, unknown>)?.[h]
      return typeof v === 'number' || typeof v === 'boolean' ? v : v == null ? '' : String(v)
    }),
  )
  return { name, grid: [headers, ...rows], headerIndex: 0, headers, rows }
}

/** CSV の文字列を作る（Excel で開けるよう、呼び出し側で BOM 付きにして保存する） */
export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** ブラウザ / Electron でファイルとして保存させる */
export function downloadText(filename: string, text: string, type: string) {
  const bom = type.startsWith('text/csv') ? '﻿' : ''
  const url = URL.createObjectURL(new Blob([bom + text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
