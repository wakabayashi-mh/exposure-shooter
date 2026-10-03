import { useMemo, useState } from 'react'
import { readTableFile, withHeaderRow, type TableSheet } from '../../../core/data/tableFile'
import { convertRows, detectHeaderRow, guessMapping, MASTER_FIELDS, type FieldKey, type Mapping } from '../logic/importMapping'
import { parseMaster, REGION_LABELS, type Condition } from '../logic/master'
import { buildMasSeries } from '../logic/masSeries'

/**
 * 施設の条件表の取り込み（SPEC 4.5）：ファイル → シート → 列の対応付け → 検証結果の確認 → 置き換え / 追加。
 * エラーの行は取り込まず、一覧で見せる。
 */
export function ImportPanel({
  current,
  onApply,
  onClose,
}: {
  current: Condition[]
  onApply: (rows: Condition[]) => Promise<void>
  onClose: () => void
}) {
  const [sheets, setSheets] = useState<TableSheet[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [error, setError] = useState('')
  const sheet = sheets?.[sheetIndex]

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      // 表の上のタイトル行を飛ばして、見出しらしい行を選ぶ
      const s = (await readTableFile(file))
        .filter((x) => x.grid.length > 0)
        .map((x) => withHeaderRow(x, detectHeaderRow(x.grid)))
      if (s.length === 0) throw new Error('表が見つかりませんでした')
      setSheets(s)
      setFileName(file.name)
      setSheetIndex(0)
      setMapping(guessMapping(s[0].headers))
    } catch (e) {
      setError(`読み込めませんでした：${(e as Error).message}`)
    }
  }

  const chooseSheet = (i: number) => {
    setSheetIndex(i)
    setMapping(guessMapping(sheets![i].headers))
  }

  const chooseHeaderRow = (row: number) => {
    const next = sheets!.map((s, i) => (i === sheetIndex ? withHeaderRow(s, row) : s))
    setSheets(next)
    setMapping(guessMapping(next[sheetIndex].headers))
  }

  const missing = mapping ? MASTER_FIELDS.filter((f) => f.required && mapping[f.key] === null) : []

  // 追加のときは、今のマスタの自動 id（custom_）と重ならないようにする
  const result = useMemo(() => {
    if (!sheet || !mapping || missing.length > 0) return null
    const reserved = new Set(mode === 'append' ? current.map((c) => c.id) : [])
    const parsed = parseMaster(convertRows(sheet.rows, mapping, reserved))
    const merged =
      mode === 'append'
        ? [...current.filter((c) => !parsed.conditions.some((n) => n.id === c.id)), ...parsed.conditions]
        : parsed.conditions
    return { ...parsed, merged, added: buildMasSeries(merged).added }
  }, [sheet, mapping, mode, current, missing.length])

  return (
    <div className="modal-backdrop" role="dialog" aria-label="条件表の取り込み">
      <div className="modal import-panel">
        <header className="modal-head">
          <h2>条件表の取り込み</h2>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </header>

        <section>
          <h3>1. ファイルを選ぶ（.xlsx / .xls / .csv / .json）</h3>
          <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={(e) => void pick(e.target.files?.[0])} />
          {fileName && <span className="muted small"> {fileName}</span>}
          {error && <p className="error-text">{error}</p>}
          {sheets && sheets.length > 1 && (
            <label className="inline">
              シート：
              <select value={sheetIndex} onChange={(e) => chooseSheet(Number(e.target.value))}>
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}（{s.rows.length} 行）
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        {sheet && mapping && (
          <section>
            <h3>2. 列の対応を確かめる（見出しから推測しています）</h3>
            <label className="header-row-pick">
              見出しの行：
              <select value={sheet.headerIndex} onChange={(e) => chooseHeaderRow(Number(e.target.value))}>
                {sheet.grid.slice(0, 15).map((r, i) => (
                  <option key={i} value={i}>
                    {i + 1} 行目：{r.filter((c) => String(c).trim() !== '').slice(0, 5).join(' / ')}
                  </option>
                ))}
              </select>
            </label>
            <div className="mapping-grid">
              {MASTER_FIELDS.map((f) => (
                <label key={f.key} className={f.required && mapping[f.key] === null ? 'missing' : ''}>
                  <span>
                    {f.label}
                    {f.required && <em> 必須</em>}
                  </span>
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={(e) =>
                      setMapping({ ...mapping, [f.key as FieldKey]: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  >
                    <option value="">（使わない）</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `（${i + 1} 列目）`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="note">
              分類が空なら部位名から推測、頻度が空なら「中」、ID が空なら自動で付けます。既知の撮影（胸部正面など）はキャラのある ID を使います。
            </p>
            {missing.length > 0 && <p className="error-text">必須の項目の列を選んでください：{missing.map((f) => f.label).join('、')}</p>}
          </section>
        )}

        {result && (
          <section>
            <h3>3. 結果を確かめる</h3>
            <p>
              取り込める行：<strong className="mono">{result.conditions.length}</strong> 行
              {result.errors.length > 0 && (
                <>
                  ／ 取り込めない行：<strong className="mono error-text">{result.errors.length}</strong> 行
                </>
              )}
            </p>
            {result.errors.length > 0 && (
              <ul className="import-errors">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    データの {e.row} 行目{e.id ? `（${e.id}）` : ''}：{e.messages.join(' / ')}
                  </li>
                ))}
              </ul>
            )}
            {result.added.length > 0 && (
              <p className="note">
                mAs 標準系列に追加される値：<span className="mono">{result.added.join(', ')}</span>
              </p>
            )}
            {result.conditions.length > 0 && (
              <div className="table-wrap preview">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th><th>分類</th><th>部位</th><th>方向</th><th>体位</th>
                      <th className="num">kV</th><th className="num">mAs</th><th className="num">距離</th><th>頻度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.conditions.slice(0, 8).map((c) => (
                      <tr key={c.id}>
                        <td className="mono">{c.id}</td><td>{REGION_LABELS[c.region]}</td><td>{c.part}</td><td>{c.view}</td><td>{c.position ?? ''}</td>
                        <td className="num mono">{c.kv}</td><td className="num mono">{c.mas}</td><td className="num mono">{c.sid}</td><td>{c.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.conditions.length > 8 && <p className="muted small">ほか {result.conditions.length - 8} 行</p>}
              </div>
            )}
            <div className="import-actions">
              <span className="segmented small-seg">
                <button className={mode === 'replace' ? 'on' : ''} onClick={() => setMode('replace')}>今のマスタと置き換える</button>
                <button className={mode === 'append' ? 'on' : ''} onClick={() => setMode('append')}>今のマスタに追加する（同じ ID は上書き）</button>
              </span>
              <button
                className="primary"
                disabled={result.conditions.length === 0}
                onClick={() => void onApply(result.merged).then(onClose)}
              >
                取り込む（{result.merged.length} 行になります）
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
