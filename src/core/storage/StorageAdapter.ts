/**
 * シリーズ共通のキー・バリュー保存口。
 * Electron 版は electron-store、将来の PWA 版は IndexedDB で実装する。
 * キーは「ゲームID/用途」の形で名前空間を付ける（例: `exposure-shooter/master`）。
 */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  /** prefix を指定するとそのキーで始まるものだけ返す */
  list(prefix?: string): Promise<string[]>
}
