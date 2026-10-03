import { useState } from 'react'
import { useProfileStore } from './profileStore'

/** プロフィールの切り替え・追加・削除（名前だけ。勉強会で 1 台を回して使う, SPEC 10） */
export function ProfileSwitcher() {
  const { profiles, currentId, select, add, remove } = useProfileStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const current = profiles.find((p) => p.id === currentId)

  const submit = async () => {
    if (!name.trim()) return
    await add(name)
    setName('')
    setOpen(false)
  }

  return (
    <div className="profile-switcher">
      <button className="profile-chip" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="profile-icon" aria-hidden>●</span>
        {current?.name ?? '…'}
        <span aria-hidden> ▾</span>
      </button>
      {open && (
        <div className="profile-menu" role="dialog" aria-label="プロフィール">
          <div className="muted small">プロフィールを選ぶ</div>
          <ul>
            {profiles.map((p) => (
              <li key={p.id} className={p.id === currentId ? 'on' : ''}>
                {confirmId === p.id ? (
                  <span className="profile-confirm">
                    「{p.name}」を削除しますか？（ランキングの記録は残ります）
                    <button className="danger" onClick={() => void remove(p.id).then(() => setConfirmId(null))}>
                      削除
                    </button>
                    <button onClick={() => setConfirmId(null)}>やめる</button>
                  </span>
                ) : (
                  <>
                    <button
                      className="profile-pick"
                      onClick={() => void select(p.id).then(() => setOpen(false))}
                    >
                      {p.id === currentId ? '✓ ' : ''}
                      {p.name}
                    </button>
                    {profiles.length > 1 && (
                      <button className="profile-remove" aria-label={`${p.name} を削除`} onClick={() => setConfirmId(p.id)}>
                        ×
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <form
            className="profile-add"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新しい名前" maxLength={16} />
            <button type="submit" disabled={!name.trim()}>
              追加
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
