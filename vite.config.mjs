import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // 相対パスで出力することで、GitHub Pages（/sumionAR/ 配下）でも
  // ローカルのファイルサーバー直下（/）でも同じビルド成果物が動く。
  base: './',
  server: {
    host: '0.0.0.0',
    port: 8000 || 4173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        'marker-ar': 'marker-ar.html',
        'location-ar': 'location-ar.html',
      }
    }
  }
});
