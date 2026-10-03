import type { StorageAdapter } from './StorageAdapter'

interface SeriesStorageBridge {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
}

declare global {
  interface Window {
    seriesStorage?: SeriesStorageBridge
  }
}

/** preload（electron/preload.ts）が公開した IPC を通して保存する */
export class ElectronStorageAdapter implements StorageAdapter {
  constructor(private readonly bridge: SeriesStorageBridge) {}

  async get<T>(key: string) {
    return (await this.bridge.get(key)) as T | undefined
  }
  set<T>(key: string, value: T) {
    return this.bridge.set(key, value)
  }
  remove(key: string) {
    return this.bridge.remove(key)
  }
  list(prefix?: string) {
    return this.bridge.list(prefix)
  }
}
