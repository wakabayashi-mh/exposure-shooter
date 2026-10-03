import { useState } from 'react'
import { CHARACTER_NAMES, characterUrl, FACE_LABELS, FACES, hasCharacter, type Face } from '../characters'
import { useDexStore } from '../dexStore'
import { REGION_LABELS, REGIONS, type Condition } from '../logic/master'
import { useMasterStore } from '../masterStore'

/**
 * キャラ図鑑（SPEC 8.3・9）：全キャラと正解条件、解説を見る。
 * 「撃破済みだけ」にすると、まだ倒していないキャラは影になって条件も隠れる。
 */
export function CharacterDexScreen({ onBack }: { onBack: () => void }) {
  const conditions = useMasterStore((s) => s.conditions)
  const defeated = new Set(useDexStore((s) => s.defeated))
  const [onlyDefeated, setOnlyDefeated] = useState(false)
  const sorted = [...conditions].sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region))
  const done = conditions.filter((c) => defeated.has(c.id)).length

  return (
    <div className="screen dex">
      <header className="screen-header">
        <button onClick={onBack}>← モード選択</button>
        <h1>キャラ図鑑</h1>
        <span className="muted">
          撃破 {done} / {conditions.length}
        </span>
        <div className="segmented small-seg push-right">
          <button className={!onlyDefeated ? 'on' : ''} onClick={() => setOnlyDefeated(false)}>
            すべて
          </button>
          <button className={onlyDefeated ? 'on' : ''} onClick={() => setOnlyDefeated(true)}>
            撃破済みだけ
          </button>
        </div>
      </header>
      <div className="dex-grid">
        {sorted.map((c) => (
          <DexCard key={c.id} condition={c} hidden={onlyDefeated && !defeated.has(c.id)} defeated={defeated.has(c.id)} />
        ))}
      </div>
    </div>
  )
}

function DexCard({ condition: c, hidden, defeated }: { condition: Condition; hidden: boolean; defeated: boolean }) {
  // 押すたびに表情を切り替える（接近中 → ロックオン → 撃破）
  const [face, setFace] = useState<Face>('approach')
  const url = hasCharacter(c.character) ? characterUrl(c.character, face) : undefined
  const next = () => setFace(FACES[(FACES.indexOf(face) + 1) % FACES.length])

  return (
    <div className={`dex-card${hidden ? ' hidden' : ''}`}>
      <button className="dex-art" onClick={next} disabled={hidden} aria-label="表情を切り替える">
        {url ? <img src={url} alt="" /> : <div className="dex-placeholder">{c.part}<br />{c.view}</div>}
        {!hidden && url && <span className="dex-face">{FACE_LABELS[face]}</span>}
        {defeated && <span className="dex-badge">撃破</span>}
      </button>
      <div className="dex-info">
        <div className="muted small">{REGION_LABELS[c.region]}</div>
        {hidden ? (
          <div className="dex-title">？？？</div>
        ) : (
          <>
            <div className="dex-title">
              {c.part} {c.view}
              {CHARACTER_NAMES[c.character] && <span className="dex-name">「{CHARACTER_NAMES[c.character]}」</span>}
            </div>
            {c.position && <div className="muted small">{c.position}</div>}
            <div className="dex-cond mono">
              {c.kv} kV ・ {c.mas} mAs ・ {c.sid} cm
            </div>
            {c.tip && <div className="dex-tip">{c.tip}</div>}
            {!hasCharacter(c.character) && <div className="muted small">キャラはまだありません</div>}
          </>
        )}
      </div>
    </div>
  )
}
