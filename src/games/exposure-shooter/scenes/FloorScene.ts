import Phaser from 'phaser'

export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 800

/** 消失点（画面中央やや上） */
const VP = { x: GAME_WIDTH / 2, y: 300 }
/** 床の横線の奥行き間隔と、流れる速さ（奥行き単位 / 秒） */
const ROW_SPACING = 1
const SCROLL_SPEED = 1.6
const ROWS = 24
/** 消失点から放射状に伸ばす縦線の本数（片側） */
const RAYS = 12
const CAMERA_HEIGHT = 500

const FONT = '"Yu Gothic UI", "Meiryo", sans-serif'

/**
 * 奥スクロールの床グリッド（SPEC 7.1）。フェーズ 1 では Phaser の動作確認用。
 * 奥行き z の床の線は、透視投影で y = VP.y + CAMERA_HEIGHT / z に描く。
 */
export class FloorScene extends Phaser.Scene {
  private floor!: Phaser.GameObjects.Graphics
  private offset = 0

  constructor() {
    super('floor')
  }

  create() {
    this.floor = this.add.graphics()
    this.add
      .text(GAME_WIDTH / 2, 120, '撮影条件シューティング', { fontFamily: FONT, fontSize: '40px', color: '#e8eef4' })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 172, 'Phaser 動作確認（フェーズ 1）', { fontFamily: FONT, fontSize: '18px', color: '#7f93a8' })
      .setOrigin(0.5)
  }

  update(_time: number, delta: number) {
    this.offset = (this.offset + (SCROLL_SPEED * delta) / 1000) % ROW_SPACING
    const g = this.floor
    g.clear()

    // 横線：手前ほど間隔が広く、明るい
    for (let i = 0; i < ROWS; i++) {
      const z = 1 + i * ROW_SPACING - this.offset
      const y = VP.y + CAMERA_HEIGHT / z
      if (y > GAME_HEIGHT) continue
      g.lineStyle(2, 0x7f93a8, Math.min(0.7, 1.4 / z))
      g.lineBetween(0, y, GAME_WIDTH, y)
    }

    // 縦線：消失点から画面下端へ
    g.lineStyle(2, 0x7f93a8, 0.35)
    for (let i = -RAYS; i <= RAYS; i++) {
      g.lineBetween(VP.x, VP.y, VP.x + i * 160, GAME_HEIGHT)
    }

    // 防衛ライン
    g.lineStyle(3, 0xc96b7b, 0.8)
    g.lineBetween(0, GAME_HEIGHT - 60, GAME_WIDTH, GAME_HEIGHT - 60)
  }
}
