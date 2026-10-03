import { defineConfig } from 'vitest/config'

// テストは純粋関数（core / logic）だけが対象。Electron プラグインは読み込まない。
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
