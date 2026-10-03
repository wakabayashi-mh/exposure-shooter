import type { StorageAdapter } from './StorageAdapter'

/** テスト用。値は structuredClone で複製し、呼び出し側の変更が漏れないようにする */
export class MemoryStorageAdapter implements StorageAdapter {
  private readonly map = new Map<string, unknown>()

  async get<T>(key: string) {
    return this.map.has(key) ? (structuredClone(this.map.get(key)) as T) : undefined
  }
  async set<T>(key: string, value: T) {
    this.map.set(key, structuredClone(value))
  }
  async remove(key: string) {
    this.map.delete(key)
  }
  async list(prefix?: string) {
    return [...this.map.keys()].filter((k) => !prefix || k.startsWith(prefix))
  }
}
