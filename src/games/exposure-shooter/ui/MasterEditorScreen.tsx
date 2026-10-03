import { useEffect, useMemo, useState } from 'react'
import { downloadText, toCsv } from '../../../core/data/tableFile'
import { FREQUENCIES, FREQUENCY_LABELS, parseMaster, REGION_LABELS, REGIONS } from '../logic/master'
import { buildMasSeries } from '../logic/masSeries'
import { buildSidOptions } from '../logic/sidOptions'
import { useMasterStore } from '../masterStore'
import { ImportPanel } from './ImportPanel'

type Row = Record<string, unknown>

/** 書き出しの列（英語のキー。取り込みでそのまま対応が付く） */
const EXPORT_KEYS = ['id', 'region', 'part', 'view', 'position', 'kv', 'mas', 'sid', 'grid', 'frequency', 'character', 'tip', 'kv_tol', 'mas_tol_steps'] as const

/**
 * マスタエディタ（SPEC 4.5）：表で行の追加・編集・削除、取り込み、書き出し。
 * 編集中はその場で検証し、エラーがなくなったら保存できる。
 */
export function MasterEditorScreen({ onBack }: { onBack: () => void }) {
  const { conditions, source, save, loadSample } = useMasterStore()
  const [draft, setDraft] = useState<Row[]>(() => conditions.map((c) => ({ ...c })))
  const [dirty, setDirty] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmSample, setConfirmSample] = useState(false)
  const [message, setMessage] = useState('')

  // 保存・取り込み・サンプルの読み直しでマスタが変わったら、編集中の表も作り直す
  useEffect(() => {
    if (!dirty) setDraft(conditions.map((c) => ({ ...c })))
  }, [conditions, dirty])

  const parsed = useMemo(() => parseMaster(draft), [draft])
  const errorsByRow = new Map(parsed.errors.map((e) => [e.row - 1, e.messages]))
  const mas = buildMasSeries(parsed.conditions)
  const sid = buildSidOptions(parsed.conditions)

  const edit = (i: number, key: string, value: unknown) => {
    setDraft((d) => d.map((r, j) => (j === i ? clean({ ...r, [key]: value }) : r)))
    setDirty(true)
    setMessage('')
  }
  const addRow = () => {
    setDraft((d) => [...d, { id: '', region: 'chest_abdomen', part: '', view: '', kv: 70, mas: 10, sid: 100, frequency: 'mid', character: '' }])
    setDirty(true)
  }
  const removeRow = (i: number) => {
    setDraft((d) => d.filter((_, j) => j !== i))
    setDirty(true)
  }
  const commit = async () => {
    // キャラが空の行は id と同じにする
    await save(draft.map((r) => (r.character ? r : { ...r, character: r.id })))
    setDirty(false)
    setMessage(`保存しました（${draft.length} 行）`)
  }
  const date = new Date().toISOString().slice(0, 10)
  const exportJson = () => downloadText(`撮影条件マスタ_${date}.json`, JSON.stringify(parsed.conditions, null, 2), 'application/json')
  const exportCsv = () =>
    downloadText(
      `撮影条件マスタ_${date}.csv`,
      toCsv(EXPORT_KEYS, parsed.conditions.map((c) => EXPORT_KEYS.map((k) => (c as Record<string, unknown>)[k] ?? ''))),
      'text/csv;charset=utf-8',
    )

  return (
    <div className="screen master">
      <header className="screen-header">
        <button onClick={onBack}>← モード選択</button>
        <h1>撮影条件マスタ</h1>
        <span className="muted">
          {draft.length} 行{source === 'sample' && !dirty ? '（サンプル）' : ''}
          {dirty ? '・未保存の変更あり' : ''}
        </span>
        <div className="push-right header-actions">
          <button onClick={() => setImporting(true)}>条件表を取り込む</button>
          <button onClick={exportCsv} disabled={dirty}>CSV で書き出す</button>
          <button onClick={exportJson} disabled={dirty}>JSON で書き出す</button>
        </div>
      </header>

      <div className="master-toolbar">
        <button onClick={addRow}>＋ 行を追加</button>
        <button className="primary" onClick={() => void commit()} disabled={!dirty || parsed.errors.length > 0}>
          保存
        </button>
        <button onClick={() => { setDirty(false); setMessage('') }} disabled={!dirty}>
          変更を取り消す
        </button>
        {confirmSample ? (
          <span className="confirm">
            今のマスタをサンプルに置き換えます。よろしいですか？
            <button className="danger" onClick={() => void loadSample().then(() => { setDirty(false); setConfirmSample(false); setMessage('サンプルに戻しました') })}>
              戻す
            </button>
            <button onClick={() => setConfirmSample(false)}>やめる</button>
          </span>
        ) : (
          <button onClick={() => setConfirmSample(true)}>サンプルに戻す</button>
        )}
        {parsed.errors.length > 0 && <span className="error-text">エラーの行が {parsed.errors.length} 行あります（赤い行）。直すと保存できます。</span>}
        {message && <span className="note" role="status">{message}</span>}
      </div>

      <div className="master-body">
        <div className="table-wrap">
          <table className="master-edit">
            <thead>
              <tr>
                <th>ID</th><th>分類</th><th>部位</th><th>方向</th><th>体位</th>
                <th className="num">kV</th><th className="num">mAs</th><th className="num">距離</th>
                <th>頻度</th><th>グリッド</th><th>キャラ</th><th>解説</th><th className="num">kV許容</th><th className="num">mAs許容段</th><th />
              </tr>
            </thead>
            <tbody>
              {draft.map((r, i) => (
                <tr key={i} className={errorsByRow.has(i) ? 'row-error' : ''} title={errorsByRow.get(i)?.join('\n')}>
                  <td><Text value={r.id} onChange={(v) => edit(i, 'id', v)} width={9} mono /></td>
                  <td>
                    <select value={String(r.region ?? '')} onChange={(e) => edit(i, 'region', e.target.value)}>
                      {REGIONS.map((x) => <option key={x} value={x}>{REGION_LABELS[x]}</option>)}
                    </select>
                  </td>
                  <td><Text value={r.part} onChange={(v) => edit(i, 'part', v)} width={6} /></td>
                  <td><Text value={r.view} onChange={(v) => edit(i, 'view', v)} width={8} /></td>
                  <td><Text value={r.position} onChange={(v) => edit(i, 'position', v)} width={5} /></td>
                  <td><Num value={r.kv} onChange={(v) => edit(i, 'kv', v)} /></td>
                  <td><Num value={r.mas} onChange={(v) => edit(i, 'mas', v)} added={typeof r.mas === 'number' && mas.added.includes(r.mas)} /></td>
                  <td><Num value={r.sid} onChange={(v) => edit(i, 'sid', v)} /></td>
                  <td>
                    <select value={String(r.frequency ?? '')} onChange={(e) => edit(i, 'frequency', e.target.value)}>
                      {FREQUENCIES.map((x) => <option key={x} value={x}>{FREQUENCY_LABELS[x]}</option>)}
                    </select>
                  </td>
                  <td className="center"><input type="checkbox" checked={r.grid === true} onChange={(e) => edit(i, 'grid', e.target.checked)} aria-label="グリッド" /></td>
                  <td><Text value={r.character} onChange={(v) => edit(i, 'character', v)} width={9} mono /></td>
                  <td><Text value={r.tip} onChange={(v) => edit(i, 'tip', v)} width={14} /></td>
                  <td><Num value={r.kv_tol} onChange={(v) => edit(i, 'kv_tol', v)} small /></td>
                  <td><Num value={r.mas_tol_steps} onChange={(v) => edit(i, 'mas_tol_steps', v)} small /></td>
                  <td><button className="row-delete" onClick={() => removeRow(i)} aria-label={`${String(r.part ?? '')} ${String(r.view ?? '')} を削除`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="derived">
          {parsed.errors.length > 0 && (
            <>
              <h2 className="error-text">エラー</h2>
              <ul className="import-errors">
                {parsed.errors.map((e) => <li key={e.row}>{e.row} 行目：{e.messages.join(' / ')}</li>)}
              </ul>
            </>
          )}
          <h2>mAs 系列（{mas.series.length} 段）</h2>
          <div className="chips">
            {mas.series.map((v) => <span key={v} className={`chip mono${mas.added.includes(v) ? ' added' : ''}`}>{v}</span>)}
          </div>
          {mas.added.length > 0 && <p className="note">追加された mAs 値: <span className="mono">{mas.added.join(', ')}</span></p>}
          <h2>撮影距離の選択肢</h2>
          <div className="chips">
            {sid.options.map((v) => <span key={v} className={`chip mono${v === sid.initial ? ' initial' : ''}`}>{v} cm</span>)}
          </div>
          <p className="note">枠付きが初期選択値（最も多く使われている距離）</p>
        </aside>
      </div>

      {importing && (
        <ImportPanel
          current={conditions}
          onClose={() => setImporting(false)}
          onApply={async (rows) => {
            await save(rows)
            setDirty(false)
            setMessage(`取り込みました（${rows.length} 行）`)
          }}
        />
      )}
    </div>
  )
}

/** 空の任意項目は持たない */
function clean(r: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(r)) if (v !== '' && v !== undefined && !(k === 'grid' && v === false)) out[k] = v
  return out
}

function Text({ value, onChange, width, mono }: { value: unknown; onChange: (v: string) => void; width: number; mono?: boolean }) {
  return <input className={mono ? 'mono' : ''} style={{ width: `${width}em` }} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
}

/** 数値の入力。読めない値は文字列のまま残し、検証でエラーにする */
function Num({ value, onChange, added, small }: { value: unknown; onChange: (v: number | string) => void; added?: boolean; small?: boolean }) {
  return (
    <input
      className={`mono num${added ? ' added' : ''}`}
      style={{ width: small ? '3.5em' : '4.5em' }}
      inputMode="decimal"
      value={value == null ? '' : String(value)}
      onChange={(e) => {
        const s = e.target.value.trim()
        // 「3.」のように打っている途中は文字列のまま持つ（数値にすると小数点が消える）
        onChange(s === '' ? '' : /^-?d*.?d+$/.test(s) ? Number(s) : s)
      }}
    />
  )
}

