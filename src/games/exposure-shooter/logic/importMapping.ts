import type { Region } from './master'

/**
 * 施設の条件表（Excel / CSV / JSON）をマスタの行に変換する（SPEC 4.5 の列マッピング）。
 * 見出しから列を推測し、値の書き方の揺れ（単位、全角、小数点のカンマ、日本語の分類名など）をならす。
 * 結果は parseMaster（zod）に渡して検証する。
 */

export const MASTER_FIELDS = [
  { key: 'part', label: '部位', required: true, synonyms: ['part', '部位', '撮影部位', '部位名'] },
  { key: 'view', label: '方向・撮影法', required: true, synonyms: ['view', '方向', '撮影方向', '撮影法', '方法', '撮影名'] },
  { key: 'position', label: '体位', required: false, synonyms: ['position', '体位'] },
  { key: 'kv', label: '管電圧 kV', required: true, synonyms: ['kv', '管電圧', '電圧'] },
  { key: 'mas', label: 'mAs', required: true, synonyms: ['mas', '管電流時間積', '電流時間積'] },
  { key: 'sid', label: '撮影距離 cm', required: true, synonyms: ['sid', 'ffd', '撮影距離', '距離'] },
  { key: 'region', label: '分類（ステージ）', required: false, synonyms: ['region', '分類', '大分類', '区分', 'ステージ', '部位分類'] },
  { key: 'frequency', label: '撮影頻度', required: false, synonyms: ['frequency', '頻度', '撮影頻度'] },
  { key: 'grid', label: 'グリッド', required: false, synonyms: ['grid', 'グリッド'] },
  { key: 'tip', label: '解説', required: false, synonyms: ['tip', '解説', 'ポイント', 'メモ', '備考', 'コメント'] },
  { key: 'id', label: 'ID', required: false, synonyms: ['id', '識別子'] },
  { key: 'character', label: 'キャラ', required: false, synonyms: ['character', 'キャラ', 'キャラクター'] },
  { key: 'kv_tol', label: 'kV 許容（個別）', required: false, synonyms: ['kv_tol', 'kv許容', '管電圧許容'] },
  { key: 'mas_tol_steps', label: 'mAs 許容段（個別）', required: false, synonyms: ['mas_tol_steps', 'mas許容', 'mas許容段'] },
] as const

export type FieldKey = (typeof MASTER_FIELDS)[number]['key']
/** 各項目に対応する列の番号（なければ null） */
export type Mapping = Record<FieldKey, number | null>

type Cell = string | number | boolean

/** 見出しを比べやすくする（全角→半角、小文字、空白・記号・単位の括弧を除く） */
export function normalizeHeader(h: string): string {
  return toHalfWidth(h)
    .toLowerCase()
    .replace(/[（(［\[【].*?[）)］\]】]/g, '')
    .replace(/[\s_・:：\-]/g, (m) => (m === '_' ? '_' : ''))
}

function toHalfWidth(s: string): string {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ')
}

/** 見出しから列の対応を推測する。完全一致を先に、次に部分一致で、1 つの列は 1 項目にだけ使う */
export function guessMapping(headers: readonly string[]): Mapping {
  const norm = headers.map(normalizeHeader)
  const mapping = Object.fromEntries(MASTER_FIELDS.map((f) => [f.key, null])) as Mapping
  const used = new Set<number>()
  for (const pass of ['exact', 'partial'] as const) {
    for (const f of MASTER_FIELDS) {
      if (mapping[f.key] !== null) continue
      const syn = f.synonyms.map(normalizeHeader)
      const i = norm.findIndex(
        (h, i) => !used.has(i) && h !== '' && (pass === 'exact' ? syn.includes(h) : syn.some((s) => h.includes(s))),
      )
      if (i >= 0) {
        mapping[f.key] = i
        used.add(i)
      }
    }
  }
  return mapping
}

/**
 * 見出しの行を探す（施設の Excel は表の上にタイトル行があることが多い）。
 * 先頭の数行のうち、見出しとして対応が付く項目が最も多い行。どの行も付かなければ 0。
 */
export function detectHeaderRow(grid: readonly (readonly Cell[])[], searchRows = 15): number {
  let best = 0
  let bestScore = 0
  grid.slice(0, searchRows).forEach((row, i) => {
    const m = guessMapping(row.map((c) => String(c)))
    const score = Object.values(m).filter((v) => v !== null).length
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  })
  return best
}

// ─── 値の変換 ───────────────────────────────────────

/** 数値に直す。「3,2」は 3.2、「120kV」「200 cm」の単位、全角数字も受け付ける。読めなければ元の文字列（検証でエラーにする） */
export function toNumber(v: Cell): number | string | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return String(v)
  const s = toHalfWidth(v).trim().replace(/\s/g, '')
  if (s === '') return undefined
  const body = s.replace(/(kv|mas|cm|ｃｍ)$/i, '').replace(/^(\d+),(\d+)$/, '$1.$2')
  const n = Number(body)
  return Number.isFinite(n) ? n : v
}

const REGION_WORDS: [Region, string[]][] = [
  ['chest_abdomen', ['chest_abdomen', '胸腹部', '胸部・腹部', '胸部', '腹部']],
  ['spine', ['spine', '脊椎', '脊柱']],
  ['upper_limb', ['upper_limb', '上肢']],
  ['lower_limb', ['lower_limb', '下肢']],
  ['head_neck', ['head_neck', '頭頸部', '頭部', '頭部・頸部']],
  ['pelvis_hip', ['pelvis_hip', '骨盤・股関節', '骨盤', '股関節']],
]

/** 部位名から分類を推測する（分類の列がないとき）。上から順に見る */
const REGION_BY_PART: [Region, RegExp][] = [
  ['pelvis_hip', /骨盤|股関節|仙腸/],
  ['spine', /椎|仙骨|尾骨|脊/],
  ['chest_abdomen', /胸|腹|肋/],
  ['upper_limb', /肩|肘|手|指|舟状|前腕|上腕|鎖骨|肩甲/],
  ['lower_limb', /膝|足|踵|下腿|大腿|趾|膝蓋/],
  ['head_neck', /頭|顔|副鼻腔|頸部|眼窩|鼻|下顎|顎|耳/],
]

export function toRegion(v: Cell | undefined, part: string): Region | string | undefined {
  const s = v === undefined ? '' : toHalfWidth(String(v)).trim()
  if (s !== '') {
    const hit = REGION_WORDS.find(([, words]) => words.includes(s) || words.includes(s.toLowerCase()))
    return hit ? hit[0] : s
  }
  return REGION_BY_PART.find(([, re]) => re.test(part))?.[0]
}

/** 頻度。空なら mid（中）にする */
export function toFrequency(v: Cell | undefined): string {
  const s = v === undefined ? '' : toHalfWidth(String(v)).trim().toLowerCase()
  if (s === '') return 'mid'
  if (['high', '高', 'h', '◎', '多'].includes(s)) return 'high'
  if (['mid', '中', 'm', '○', '〇', '普通'].includes(s)) return 'mid'
  if (['low', '低', 'l', '△', '少'].includes(s)) return 'low'
  return s
}

export function toGrid(v: Cell | undefined): boolean | string | undefined {
  if (typeof v === 'boolean') return v
  const s = v === undefined ? '' : toHalfWidth(String(v)).trim().toLowerCase()
  if (s === '') return undefined
  if (['true', '1', 'あり', '有', '○', '〇', 'yes', '使用', '+'].includes(s)) return true
  if (['false', '0', 'なし', '無', '×', 'x', 'no', '-', '未使用'].includes(s)) return false
  return s
}

/** 既知の撮影（キャラがあるもの）を部位と方向から見つけて、その id を使う */
const KNOWN: [RegExp, RegExp, string][] = [
  [/^胸部$/, /正面|PA/i, 'chest_pa'],
  [/^胸部$/, /側面/, 'chest_lat'],
  [/^腹部$/, /正面|臥位/, 'abdomen_supine'],
  [/^頸椎$/, /開口/, 'c_spine_open_mouth'],
  [/^頸椎$/, /側面/, 'c_spine_lat'],
  [/^腰椎$/, /正面|AP/i, 'l_spine_ap'],
  [/^手$/, /正面|PA/i, 'hand_pa'],
  [/^手関節$/, /側面/, 'wrist_lat'],
  [/^舟状骨$/, /./, 'scaphoid'],
  [/^膝(関節)?$/, /側面/, 'knee_lat'],
  [/^足関節$/, /正面|AP/i, 'ankle_ap'],
  [/^頭部$/, /正面|PA/i, 'skull_pa'],
  [/^頭部$/, /側面/, 'skull_lat'],
  [/^骨盤$/, /正面|AP/i, 'pelvis_ap'],
  [/^股関節$/, /ラウエン/, 'hip_lauenstein'],
]

export function knownId(part: string, view: string): string | undefined {
  return KNOWN.find(([p, v]) => p.test(part.trim()) && v.test(view))?.[2]
}

/** 0 → a, 25 → z, 26 → ba …（id は英小文字とアンダースコアだけなので数字を使わない） */
export function letters(n: number): string {
  let s = ''
  do {
    s = String.fromCharCode(97 + (n % 26)) + s
    n = Math.floor(n / 26)
  } while (n > 0)
  return s
}

/** 表の行をマスタの行（未検証）に変換する。reservedIds は自動の id で使わない id（追加で取り込むときの既存の id） */
export function convertRows(
  rows: readonly Cell[][],
  mapping: Mapping,
  reservedIds: ReadonlySet<string> = new Set(),
): Record<string, unknown>[] {
  const usedIds = new Set<string>()
  let seq = 0
  return rows.map((row) => {
    const get = (k: FieldKey): Cell | undefined => {
      const i = mapping[k]
      if (i === null || i === undefined) return undefined
      const v = row[i]
      return v === '' ? undefined : v
    }
    const str = (k: FieldKey) => {
      const v = get(k)
      return v === undefined ? undefined : toHalfWidth(String(v)).trim() || undefined
    }
    const part = String(get('part') ?? '').trim()
    const view = String(get('view') ?? '').trim()

    let id = str('id')?.toLowerCase()
    if (!id || usedIds.has(id)) {
      const known = knownId(part, view)
      id = known && !usedIds.has(known) ? known : nextCustomId()
    }
    usedIds.add(id)

    const out: Record<string, unknown> = {
      id,
      region: toRegion(get('region'), part),
      part,
      view,
      position: str('position'),
      kv: toNumber(get('kv') ?? ''),
      mas: toNumber(get('mas') ?? ''),
      sid: toNumber(get('sid') ?? ''),
      grid: toGrid(get('grid')),
      frequency: toFrequency(get('frequency')),
      character: str('character') ?? id,
      tip: str('tip'),
      kv_tol: toNumber(get('kv_tol') ?? ''),
      mas_tol_steps: toNumber(get('mas_tol_steps') ?? ''),
    }
    // 空の任意項目は持たない（zod の optional に合わせる）
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
    return out
  })

  function nextCustomId() {
    let id: string
    do id = `custom_${letters(seq++)}`
    while (usedIds.has(id) || reservedIds.has(id))
    return id
  }
}
