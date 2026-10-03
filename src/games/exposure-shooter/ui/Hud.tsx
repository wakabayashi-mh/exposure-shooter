import { useEffect, useState } from 'react'
import { FEEDBACK } from '../logic/constants'
import { comboMultiplier } from '../logic/session'
import { PARAM_LABELS, PARAM_ORDER, type ParamKey } from '../logic/params'
import { useShallow } from 'zustand/react/shallow'
import { usePlayStore } from '../playStore'

/** 上段：ステージ名・モード・残り時間（左）、ライフ（中央）、スコア・コンボ（右） */
export function TopBar() {
  const { stageName, modeLabel, clock, lives, maxLives, score, combo } = usePlayStore()
  return (
    <div className="hud-top">
      <div className="hud-top-left">
        <span className="stage-name">{stageName}</span>
        <span className="muted">{modeLabel}</span>
        <span className={`mono time${clock.warn ? ' warn' : ''}`}>{clock.label}</span>
      </div>
      <div className="hud-lives" aria-label={`ライフ ${lives}`}>
        {Array.from({ length: maxLives }, (_, i) => (
          <span key={i} className={i < lives ? 'life on' : 'life'}>
            ♥
          </span>
        ))}
      </div>
      <div className="hud-top-right">
        <span className="mono score">{score.toLocaleString()}</span>
        <span className="mono combo">{combo > 0 ? `${combo} COMBO ×${comboMultiplier(combo)}` : ''}</span>
      </div>
    </div>
  )
}

/** 右パネル：ロックオン中の敵の情報（SPEC 7.2） */
export function TargetPanel() {
  const target = usePlayStore((s) => s.target)
  return (
    <div className="hud-target">
      <div className="panel-title">ロックオン</div>
      {target ? (
        <>
          <div className="target-part">{target.condition.part}</div>
          <div className="target-view">{target.condition.view}</div>
          {target.condition.position && <div className="muted">{target.condition.position}</div>}
          <div className="target-eta">
            接近まで <span className="mono">{target.remainingSec.toFixed(1)}</span> 秒
          </div>
          {target.fixed && <div className="target-fixed">照準固定中</div>}
        </>
      ) : (
        <p className="muted small">
          <span className="only-mouse">
            敵にカーソルを重ねるとロックオン。
            <br />
            Tab で近い敵へ切り替え。
          </span>
          <span className="only-touch">敵をタップしてロックオン。</span>
        </p>
      )}
      <div className="help small muted only-mouse">
        ホイール：値を変える
        <br />
        右クリック：kV / mAs / 距離 を切り替え
        <br />
        左クリック長押し：準備 → 離して曝射
      </div>
      <div className="help small muted only-touch">
        敵をタップ：ロックオン
        <br />
        ▲▼：値を変える
        <br />
        曝射パネル長押し：準備 → 離して曝射
      </div>
    </div>
  )
}

/** 下段の操作パネル：kV・mAs・撮影距離のダイヤルと曝射スイッチ（SPEC 9.1） */
export function ControlPanel() {
  return (
    <div className="hud-controls">
      {PARAM_ORDER.map((key) => (
        <Dial key={key} param={key} />
      ))}
      <TriggerPanel />
    </div>
  )
}

function Dial({ param }: { param: ParamKey }) {
  const { value, options, selected, select, step } = usePlayStore(
    useShallow((s) => ({
      value: s.params[param],
      options: s.options[param],
      selected: s.selected === param,
      select: s.select,
      step: s.step,
    })),
  )
  const i = options.indexOf(value)
  const prev = i > 0 ? options[i - 1] : null
  const next = i >= 0 && i < options.length - 1 ? options[i + 1] : null
  const { label, unit } = PARAM_LABELS[param]
  return (
    <div className={`dial${selected ? ' selected' : ''}`} onMouseEnter={() => select(param)}>
      <div className="dial-label">{label}</div>
      <div className="dial-values mono">
        <span className="dial-side">{prev ?? ''}</span>
        <span className="dial-value">{Number.isNaN(value) ? '—' : value}</span>
        <span className="dial-side">{next ?? ''}</span>
      </div>
      <div className="dial-unit">{unit}</div>
      {/* タッチ用（マウスの環境では CSS で隠す） */}
      <button className="dial-step up only-touch" aria-label={`${label}を上げる`} onClick={() => step(param, 1)}>
        ▲
      </button>
      <button className="dial-step down only-touch" aria-label={`${label}を下げる`} onClick={() => step(param, -1)}>
        ▼
      </button>
    </div>
  )
}

function TriggerPanel() {
  const { phase, progress } = usePlayStore((s) => s.exposure)
  const text =
    phase === 'preparing'
      ? '準備中…'
      : phase === 'ready'
        ? 'READY　離して曝射'
        : phase === 'overheat'
          ? '管球負荷　離してください'
          : '長押しで準備'
  return (
    <div className={`trigger ${phase}`}>
      <div className="trigger-row">
        <span className="trigger-num">①</span>
        <span>準備</span>
        <div className="gauge">
          <div className="gauge-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="trigger-row">
        <span className="trigger-num">②</span>
        <span>曝射</span>
        <span className={`ready-lamp${phase === 'ready' ? ' on' : ''}`} />
      </div>
      <div className="trigger-text">{text}</div>
    </div>
  )
}

export function Toast() {
  const toast = usePlayStore((s) => s.toast)
  const [visible, setVisible] = useState<typeof toast>(null)
  useEffect(() => {
    if (!toast) return
    setVisible(toast)
    const id = setTimeout(() => setVisible(null), FEEDBACK.toastMs)
    return () => clearTimeout(id)
  }, [toast])
  return visible ? (
    <div key={visible.id} className="hud-toast">
      {visible.text}
    </div>
  ) : null
}
