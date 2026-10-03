import { useEffect, useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../logic/constants'
import { allTables, tableKey, tableLabel } from '../logic/rankingRules'
import { KEY_ACTION_LABELS, keyLabel, PREP_RANGE_MS, type GameSettings, type KeyAction } from '../logic/settings'
import { useMasterStore } from '../masterStore'
import { useRankingStore } from '../rankingStore'
import { useSettingsStore } from '../settingsStore'

const DIFFS = Object.keys(DIFFICULTIES) as Difficulty[]

/** 設定（SPEC 9）。mAs 系列と撮影距離の選択肢はマスタから作るので表示だけ */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, update, reset } = useSettingsStore()
  const { mas, sid } = useMasterStore()
  const [listening, setListening] = useState<KeyAction | null>(null)
  const [confirm, setConfirm] = useState<'settings' | 'ranking' | null>(null)
  const [rankTarget, setRankTarget] = useState<string>('all')
  const tables = useRankingStore((s) => s.tables)
  const resetRanking = useRankingStore((s) => s.reset)
  const [done, setDone] = useState('')

  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => void update({ [k]: v } as Partial<GameSettings>)
  const setTol = (d: Difficulty, k: 'kvTol' | 'masTolSteps', v: number) =>
    set('tolerance', { ...settings.tolerance, [d]: { ...settings.tolerance[d], [k]: v } })

  // キー割り当て：次に押したキーを割り当てる（Esc でやめる）
  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.code !== 'Escape') {
        // 同じキーがほかの操作に付いていたら入れ替える
        const keys = { ...settings.keys }
        const other = (Object.keys(keys) as KeyAction[]).find((a) => keys[a] === e.code && a !== listening)
        if (other) keys[other] = keys[listening]
        keys[listening] = e.code
        set('keys', keys)
      }
      setListening(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  })

  const rankedTables = allTables().filter((t) => (tables[tableKey(t)] ?? []).length > 0)

  return (
    <div className="screen settings">
      <header className="screen-header">
        <button onClick={onBack}>← モード選択</button>
        <h1>設定</h1>
        <span className="muted">変更はすぐ保存され、次のプレイから使われます</span>
      </header>

      <div className="settings-body">
        <section>
          <h2>許容値（この範囲なら撃破）</h2>
          <table className="settings-table">
            <thead>
              <tr>
                <th>難易度</th>
                <th>kV 許容（±kV）</th>
                <th>mAs 許容（±段）</th>
                <th>ロックオン中の時間の流れ</th>
              </tr>
            </thead>
            <tbody>
              {DIFFS.map((d) => (
                <tr key={d}>
                  <td>{DIFFICULTIES[d].label}</td>
                  <td>
                    <NumberInput value={settings.tolerance[d].kvTol} min={0} max={30} onChange={(v) => setTol(d, 'kvTol', v)} />
                  </td>
                  <td>
                    <NumberInput value={settings.tolerance[d].masTolSteps} min={0} max={5} onChange={(v) => setTol(d, 'masTolSteps', v)} />
                  </td>
                  <td>
                    <input
                      type="range" min={0.1} max={1} step={0.05} value={settings.slowFactor[d]}
                      onChange={(e) => set('slowFactor', { ...settings.slowFactor, [d]: Number(e.target.value) })}
                    />
                    <span className="mono"> ×{settings.slowFactor[d].toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">撮影距離は常に完全一致。ハードモードは難易度にかかわらず「ハード」の許容値を使います。マスタの行に個別の許容値があればそちらが優先です。</p>
        </section>

        <section className="settings-grid">
          <label>
            準備（ロートアップ）時間
            <span>
              <input
                type="range" min={PREP_RANGE_MS.min} max={PREP_RANGE_MS.max} step={100} value={settings.prepMs}
                onChange={(e) => set('prepMs', Number(e.target.value))}
              />
              <span className="mono"> {(settings.prepMs / 1000).toFixed(1)} 秒</span>
            </span>
          </label>
          <label>
            kV ダイヤルの 1 刻み
            <span className="segmented small-seg">
              {([1, 2, 5] as const).map((v) => (
                <button key={v} className={settings.kvStep === v ? 'on' : ''} onClick={() => set('kvStep', v)}>
                  {v} kV
                </button>
              ))}
            </span>
          </label>
          <label>
            MISS の吹き出しを出す時間
            <span>
              <input
                type="range" min={1000} max={6000} step={500} value={settings.missBubbleMs}
                onChange={(e) => set('missBubbleMs', Number(e.target.value))}
              />
              <span className="mono"> {(settings.missBubbleMs / 1000).toFixed(1)} 秒</span>
            </span>
          </label>
          <label>
            パラメータの切り替え
            <span className="checkbox">
              右クリック ＋
              <input type="checkbox" checked={settings.middleButtonCycles} onChange={(e) => set('middleButtonCycles', e.target.checked)} />
              中ボタン（ホイールクリック）
            </span>
          </label>
          <label>
            音量（効果音は今後追加）
            <span>
              <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => set('volume', Number(e.target.value))} />
              <span className="mono"> {Math.round(settings.volume * 100)}%</span>
            </span>
          </label>
        </section>

        <section>
          <h2>キー割り当て</h2>
          <div className="keys-grid">
            {(Object.keys(KEY_ACTION_LABELS) as KeyAction[]).map((a) => (
              <div key={a} className="key-row">
                <span>{KEY_ACTION_LABELS[a]}</span>
                <button className={`key-cap mono${listening === a ? ' listening' : ''}`} onClick={() => setListening(listening === a ? null : a)}>
                  {listening === a ? 'キーを押す…（Esc でやめる）' : keyLabel(settings.keys[a])}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>マスタから作る選択肢（表示のみ）</h2>
          <p className="note">mAs 系列（{mas.series.length} 段）：<span className="mono">{mas.series.join('  ')}</span></p>
          {mas.added.length > 0 && <p className="note">マスタから追加した mAs：<span className="mono">{mas.added.join(', ')}</span></p>}
          <p className="note">撮影距離：<span className="mono">{sid.options.join(' / ')} cm</span>（初期値 {sid.initial} cm）</p>
        </section>

        <section>
          <h2>リセット</h2>
          <div className="reset-row">
            <select value={rankTarget} onChange={(e) => setRankTarget(e.target.value)}>
              <option value="all">ランキングをすべて</option>
              {rankedTables.map((t) => (
                <option key={tableKey(t)} value={tableKey(t)}>
                  {tableLabel(t)}
                </option>
              ))}
            </select>
            {confirm === 'ranking' ? (
              <span className="confirm">
                {rankTarget === 'all' ? 'すべてのランキング' : tableLabel(allTables().find((t) => tableKey(t) === rankTarget)!)}を消します。よろしいですか？
                <button
                  className="danger"
                  onClick={() => void resetRanking(rankTarget === 'all' ? undefined : rankTarget).then(() => { setConfirm(null); setRankTarget('all'); setDone('ランキングを消しました') })}
                >
                  消す
                </button>
                <button onClick={() => setConfirm(null)}>やめる</button>
              </span>
            ) : (
              <button onClick={() => setConfirm('ranking')} disabled={rankedTables.length === 0}>
                ランキングを消す
              </button>
            )}
          </div>
          <div className="reset-row">
            {confirm === 'settings' ? (
              <span className="confirm">
                設定を既定値に戻します。よろしいですか？
                <button className="danger" onClick={() => void reset().then(() => { setConfirm(null); setDone('設定を既定値に戻しました') })}>
                  戻す
                </button>
                <button onClick={() => setConfirm(null)}>やめる</button>
              </span>
            ) : (
              <button onClick={() => setConfirm('settings')}>設定を既定値に戻す</button>
            )}
          </div>
          {done && <p className="note" role="status">{done}</p>}
        </section>
      </div>
    </div>
  )
}

function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="number-input">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="減らす">−</button>
      <span className="mono">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="増やす">＋</button>
    </span>
  )
}
