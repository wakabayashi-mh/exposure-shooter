# 撮影条件シューティング（仮称）

放射線技師教育ゲームシリーズ 第 1 作。一般撮影の撮影条件（管電圧・mAs・撮影距離）をシューティングゲームで覚える。
仕様は [docs/SPEC.md](docs/SPEC.md) を正とする。

## 開発

```bash
npm install
npm run dev        # Electron で起動（Vite の開発サーバー＋Electron ウィンドウ）
npm run dev:web    # ブラウザだけで起動（保存先は localStorage）
npm test           # ユニットテスト（Vitest）
npm run typecheck
npm run build      # Windows インストーラを release/ に作る
```

## 構成

| 場所 | 中身 |
|---|---|
| `electron/` | main（ウィンドウ・electron-store）と preload（ストレージ IPC） |
| `src/core/storage/` | `StorageAdapter` と実装（Electron / localStorage / メモリ） |
| `src/core/data/` | zod による行単位の検証 |
| `src/games/exposure-shooter/logic/` | マスタのスキーマ、mAs 系列、撮影距離の選択肢（純粋関数・テスト対象） |
| `src/games/exposure-shooter/scenes/` | Phaser シーン |
| `src/games/exposure-shooter/ui/` | React の画面 |
| `src/app/` | 画面遷移とタイトル |
| `data/conditions.sample.json` | 開発用ダミーマスタ（**条件値はダミー**） |

保存データ（Electron 版）は `%APPDATA%\撮影条件シューティング\radtech-series.json` に入る。

## 動作確認の手順

### フェーズ 1（基盤）

1. `npm test` が全件通る。
2. `npm run dev` で Electron ウィンドウが開き、タイトル画面が出る。
3. 「撮影条件マスタ」を押すと、サンプルマスタ 15 行が分類順に表示される。
   - 右側の mAs 系列に、標準系列にない `7`（膝関節 側面のダミー値）が黄色で追加されている。
   - 撮影距離の選択肢が `100 / 150 / 180 cm` で、最も多い `100 cm` に枠が付いている。
4. アプリを終了して起動し直し、マスタ画面の件数表示から「（サンプル）」が消えている（保存済みのマスタを読み込んでいる）。
5. タイトルの「プレイ（試作）」で、奥へ流れる床グリッドの Phaser 画面が出る。「戻る」でタイトルに戻れる。
