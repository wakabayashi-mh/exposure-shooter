import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// 完全オフライン動作: 外部 CDN への参照は持たない。
// `--mode web` のときは Electron を起動せず、ブラウザだけで確認できるようにする（将来の PWA 版の土台）。
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    ...(mode === 'web'
      ? []
      : [
          electron({
            main: {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  rollupOptions: {
                    output: { format: 'cjs', entryFileNames: 'main.js' },
                  },
                },
              },
            },
            preload: {
              input: 'electron/preload.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  rollupOptions: {
                    output: { format: 'cjs', entryFileNames: 'preload.js' },
                  },
                },
              },
            },
          }),
        ]),
  ],
}))
