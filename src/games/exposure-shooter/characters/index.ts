/**
 * 敵キャラの SVG（SPEC 8）。1 ファイルに 3 つの表情をグループで持ち、表示する表情以外を隠して使う。
 * SVG がない撮影は、呼び出し側でプレースホルダー（部位名と方向の札）を出す。
 */

export const FACES = ['approach', 'lockon', 'defeated'] as const
export type Face = (typeof FACES)[number]

export const FACE_LABELS: Record<Face, string> = { approach: '接近中', lockon: 'ロックオン', defeated: '撃破' }

/** 名前があるキャラ（ほかは未定。SPEC 13） */
export const CHARACTER_NAMES: Record<string, string> = { chest_pa: 'レンちゃん' }

/** SVG の描画サイズ（viewBox と同じ。ゲーム内では 150×200 に縮めて表示する） */
export const CHARACTER_SIZE = { width: 300, height: 400 }

const files = import.meta.glob('./*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sources = new Map(Object.entries(files).map(([file, svg]) => [file.slice(2, -4), svg]))

export function hasCharacter(id: string): boolean {
  return sources.has(id)
}

/** 指定した表情だけを表示する SVG 文字列 */
export function characterSvg(id: string, face: Face): string | undefined {
  const svg = sources.get(id)
  if (!svg) return undefined
  return svg
    .replace('<svg ', `<svg width="${CHARACTER_SIZE.width}" height="${CHARACTER_SIZE.height}" `)
    .replace(/<g id="face-(\w+)"/g, (m, f) => (f === face ? m : `${m} display="none"`))
}

const urlCache = new Map<string, string>()

/** <img> や Phaser のテクスチャに使える data URL */
export function characterUrl(id: string, face: Face): string | undefined {
  const key = `${id}:${face}`
  if (!urlCache.has(key)) {
    const svg = characterSvg(id, face)
    if (!svg) return undefined
    urlCache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  }
  return urlCache.get(key)
}

export function textureKey(id: string, face: Face): string {
  return `char:${id}:${face}`
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

/** 表情ごとの画像を読み込む（一度読んだものは使い回す） */
export function loadCharacterImage(id: string, face: Face): Promise<HTMLImageElement> | undefined {
  const url = characterUrl(id, face)
  if (!url) return undefined
  const key = `${id}:${face}`
  if (!imageCache.has(key)) {
    imageCache.set(
      key,
      new Promise((resolve, reject) => {
        const img = new Image(CHARACTER_SIZE.width, CHARACTER_SIZE.height)
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`キャラ画像を読み込めませんでした: ${key}`))
        img.src = url
      }),
    )
  }
  return imageCache.get(key)
}
