import { getStorage } from '../storage'

/**
 * 学習履歴の保存（SPEC 10）。ゲームごと・プロフィールごとに、1 プレイ 1 件の記録を積む。
 * 中身（T）の形と集計はゲーム側が決める。
 */
const key = (gameId: string, profileId: string) => `${gameId}/history/${profileId}`

/** 1 人ぶんの記録が増えすぎないように、古いものから捨てる */
const MAX_PLAYS = 500

export async function loadHistory<T>(gameId: string, profileId: string): Promise<T[]> {
  return (await getStorage().get<T[]>(key(gameId, profileId))) ?? []
}

export async function appendHistory<T>(gameId: string, profileId: string, play: T): Promise<void> {
  const plays = await loadHistory<T>(gameId, profileId)
  await getStorage().set(key(gameId, profileId), [...plays, play].slice(-MAX_PLAYS))
}

export async function clearHistory(gameId: string, profileId: string): Promise<void> {
  await getStorage().remove(key(gameId, profileId))
}
