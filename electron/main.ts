import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import Store from 'electron-store'

// ─── core ストレージ（StorageAdapter の Electron 実装の本体） ─────────
// レンダラーからは preload の IPC 経由でしか触らない。
// キーに "." を含めても入れ子扱いにならないよう、1 つのレコードにまとめて持つ。
type Entries = Record<string, unknown>

const store = new Store<{ entries: Entries }>({
  name: 'radtech-series',
  defaults: { entries: {} },
})

const entries = (): Entries => store.get('entries')

ipcMain.handle('storage:get', (_e, key: string) => entries()[key])
ipcMain.handle('storage:set', (_e, key: string, value: unknown) => {
  store.set('entries', { ...entries(), [key]: value })
})
ipcMain.handle('storage:remove', (_e, key: string) => {
  const next = { ...entries() }
  delete next[key]
  store.set('entries', next)
})
ipcMain.handle('storage:list', (_e, prefix?: string) =>
  Object.keys(entries()).filter((k) => !prefix || k.startsWith(prefix)),
)

// ─── ウィンドウ ──────────────────────────────────────────────────
// 基準解像度は 1280×800（SPEC 9.1）。
let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    useContentSize: true,
    backgroundColor: '#0f1826',
    autoHideMenuBar: true,
    title: '撮影条件シューティング',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
