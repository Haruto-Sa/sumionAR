import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
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
        'location-ar-targets2': 'location-ar-targets2.html',
        'location-ar-manual': 'location-ar-manual.html'
      }
    }
  }
});
