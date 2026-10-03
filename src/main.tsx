import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/styles.css'
import { useProfileStore } from './core/profile/profileStore'
import { useMasterStore } from './games/exposure-shooter/masterStore'
import { useRankingStore } from './games/exposure-shooter/rankingStore'
import { useSettingsStore } from './games/exposure-shooter/settingsStore'

// 起動時に読む：マスタ（保存済みがなければサンプルを保存）、プロフィール、設定、ランキング
void useMasterStore.getState().load()
void useProfileStore.getState().load()
void useSettingsStore.getState().load()
void useRankingStore.getState().load()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
