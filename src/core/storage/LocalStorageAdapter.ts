import type { StorageAdapter } from './StorageAdapter'

/**
 * ブラウザだけで開発するとき（`npm run dev:web`）の仮実装。
 * PWA 版では IndexedDB 実装に置き換える（SPEC 2）。
 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly namespace = 'radtech-series:') {}

  async get<T>(key: string) {
    const raw = localStorage.getItem(this.namespace + key)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  }
  async set<T>(key: string, value: T) {
    localStorage.setItem(this.namespace + key, JSON.stringify(value))
  }
  async remove(key: string) {
    localStorage.removeItem(this.namespace + key)
  }
  async list(prefix?: string) {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(this.namespace)) keys.push(k.slice(this.namespace.length))
    }
    return keys.filter((k) => !prefix || k.startsWith(prefix))
  }
}
