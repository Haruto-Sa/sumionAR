import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/sumionAR/',
  server: {
    host: true,
    port: 8000,
    strictPort: true,
    allowedHosts: ['*'],
    cors: true,
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
