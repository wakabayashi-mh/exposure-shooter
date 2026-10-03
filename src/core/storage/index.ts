import { ElectronStorageAdapter } from './ElectronStorageAdapter'
import { LocalStorageAdapter } from './LocalStorageAdapter'
import type { StorageAdapter } from './StorageAdapter'

export type { StorageAdapter } from './StorageAdapter'
export { MemoryStorageAdapter } from './MemoryStorageAdapter'

let instance: StorageAdapter | undefined

/** 実行環境に合った StorageAdapter を返す（Electron なら IPC、ブラウザなら localStorage） */
export function getStorage(): StorageAdapter {
  instance ??= window.seriesStorage
    ? new ElectronStorageAdapter(window.seriesStorage)
    : new LocalStorageAdapter()
  return instance
}
