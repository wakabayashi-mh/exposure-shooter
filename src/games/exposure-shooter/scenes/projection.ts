import type Phaser from 'phaser'

/** 画面の基準解像度（SPEC 9.1） */
export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 800

/**
 * 疑似 3D の投影（SPEC 7.1）。奥行き z の床の点は y = VP.y + CAMERA_HEIGHT / z に写る。
 * 右パネル（x ≥ 980）と下段の操作パネル（y ≥ 620）を避けて、消失点を左上寄りに置く。
 */
export const VP = { x: 490, y: 220 }
export const CAMERA_HEIGHT = 400
/** 防衛ライン。敵の足元がここに来たら到達 */
export const DEFENSE_Y = 600
/** 敵が出現する奥行きと、防衛ラインの奥行き */
export const Z_FAR = 14
export const Z_NEAR = CAMERA_HEIGHT / (DEFENSE_Y - VP.y)
/** レーン 1 つぶんの横幅（z = 1 のとき） */
export const LANE_WIDTH = 210

export interface Projected {
  x: number
  /** 足元の y */
  y: number
  scale: number
}

export function project(lane: number, z: number): Projected {
  return { x: VP.x + (lane * LANE_WIDTH) / z, y: VP.y + CAMERA_HEIGHT / z, scale: 1 / z }
}

/**
 * 接近の進み具合（0: 出現, 1: 防衛ライン）から奥行きを求める。
 * 奥行きを一定の速さで縮めると最後の一瞬で急に大きくなり読みにくいので、画面上の大きさ（1/z）を一定の速さで大きくする。
 */
export function depthAt(progress: number): number {
  return 1 / (1 / Z_FAR + (1 / Z_NEAR - 1 / Z_FAR) * progress)
}

const FLOOR_ROWS = 28
const FLOOR_RAYS = 12

/** 奥へ流れる床グリッドと防衛ラインを描く。offset は 0〜1 の流れ位置 */
export function drawFloor(g: Phaser.GameObjects.Graphics, offset: number) {
  g.clear()
  for (let i = 0; i < FLOOR_ROWS; i++) {
    const z = 1 + i - offset
    const y = VP.y + CAMERA_HEIGHT / z
    if (y > GAME_HEIGHT) continue
    g.lineStyle(2, 0x7f93a8, Math.min(0.55, 1.2 / z))
    g.lineBetween(0, y, GAME_WIDTH, y)
  }
  g.lineStyle(2, 0x7f93a8, 0.28)
  for (let i = -FLOOR_RAYS; i <= FLOOR_RAYS; i++) {
    g.lineBetween(VP.x, VP.y, VP.x + i * 150, GAME_HEIGHT)
  }
  g.lineStyle(4, 0xc96b7b, 0.85)
  g.lineBetween(0, DEFENSE_Y, GAME_WIDTH, DEFENSE_Y)
}
