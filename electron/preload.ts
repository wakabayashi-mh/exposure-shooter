import { contextBridge, ipcRenderer } from 'electron'

// core/storage の ElectronStorageAdapter が使う窓口。ゲーム本体はこれを直接触らない。
contextBridge.exposeInMainWorld('seriesStorage', {
  get: (key: string) => ipcRenderer.invoke('storage:get', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('storage:set', key, value),
  remove: (key: string) => ipcRenderer.invoke('storage:remove', key),
  list: (prefix?: string) => ipcRenderer.invoke('storage:list', prefix),
})
