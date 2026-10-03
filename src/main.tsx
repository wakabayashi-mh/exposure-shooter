import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/styles.css'
import { useMasterStore } from './games/exposure-shooter/masterStore'

// 撮影条件マスタは起動時に読む（保存済みがなければサンプルを読み込んで保存する）
void useMasterStore.getState().load()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
