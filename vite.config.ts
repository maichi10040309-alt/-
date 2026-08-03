import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // キャラクター/建物のイラストをJSに直接埋め込み、単一HTMLへの書き出しでも
    // 別ファイル参照なしで動くようにする(Artifact配布のため)
    assetsInlineLimit: 300 * 1024,
  },
});
