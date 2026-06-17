import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api-golf': {
        target: 'https://api.golfcourseapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-golf/, '')
      }
    }
  },
  preview: {
    allowedHosts: ['.up.railway.app'],
    proxy: {
      '/api-golf': {
        target: 'https://api.golfcourseapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-golf/, '')
      }
    }
  }
});
