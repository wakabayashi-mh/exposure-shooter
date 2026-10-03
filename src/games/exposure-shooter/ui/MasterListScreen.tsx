import { FREQUENCY_LABELS, REGION_LABELS, REGIONS } from '../logic/master'
import { useMasterStore } from '../masterStore'

/** 条件マスタの一覧（フェーズ 1 の確認画面。フェーズ 5 でマスタエディタに育てる） */
export function MasterListScreen({ onBack }: { onBack: () => void }) {
  const { status, source, conditions, errors, mas, sid, loadSample } = useMasterStore()

  const added = new Set(mas.added)
  const sorted = [...conditions].sort(
    (a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region),
  )

  return (
    <div className="screen master">
      <header className="screen-header">
        <button onClick={onBack}>← 戻る</button>
        <h1>撮影条件マスタ</h1>
        <span className="muted">
          {status === 'ready'
            ? `${conditions.length} 行${source === 'sample' ? '（サンプル）' : ''}`
            : '読み込み中…'}
        </span>
        <button className="push-right" onClick={() => void loadSample()}>
          サンプルを読み込み直す
        </button>
      </header>

      {errors.length > 0 && (
        <section className="errors">
          <h2>読み込めなかった行（{errors.length}）</h2>
          <ul>
            {errors.map((e) => (
              <li key={e.row}>
                {e.row} 行目{e.id ? `（${e.id}）` : ''}: {e.messages.join(' / ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="master-body">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>分類</th>
                <th>部位</th>
                <th>方向</th>
                <th>体位</th>
                <th className="num">kV</th>
                <th className="num">mAs</th>
                <th className="num">距離</th>
                <th>頻度</th>
                <th>解説</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td>{REGION_LABELS[c.region]}</td>
                  <td>{c.part}</td>
                  <td>{c.view}</td>
                  <td>{c.position ?? ''}</td>
                  <td className="num mono">{c.kv}</td>
                  <td className={`num mono${added.has(c.mas) ? ' added' : ''}`}>{c.mas}</td>
                  <td className="num mono">{c.sid}</td>
                  <td>{FREQUENCY_LABELS[c.frequency]}</td>
                  <td className="tip">{c.tip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="derived">
          <h2>mAs 系列（{mas.series.length} 段）</h2>
          <div className="chips">
            {mas.series.map((v) => (
              <span key={v} className={`chip mono${added.has(v) ? ' added' : ''}`}>
                {v}
              </span>
            ))}
          </div>
          {mas.added.length > 0 && (
            <p className="note">
              追加された mAs 値: <span className="mono">{mas.added.join(', ')}</span>
            </p>
          )}

          <h2>撮影距離の選択肢</h2>
          <div className="chips">
            {sid.options.map((v) => (
              <span key={v} className={`chip mono${v === sid.initial ? ' initial' : ''}`}>
                {v} cm
              </span>
            ))}
          </div>
          <p className="note">枠付きが初期選択値（最も多く使われている距離）</p>
        </aside>
      </div>
    </div>
  )
}
