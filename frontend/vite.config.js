import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Keep the framework in its own chunk.
         *
         * React, the router, react-query and axios change when we upgrade them
         * — a few times a year — while the app changes several times a day.
         * Bundled together, every deploy invalidated the whole 379 kB for
         * everyone, including the ~250 kB of dependencies that were byte for
         * byte identical to what the browser already had.
         *
         * Split by SOURCE, not by size: a chunk is only worth caching if the
         * thing that makes it change is different from what makes the rest
         * change, and "these are the packages we do not write" is exactly that
         * line.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          if (/[\\/]node_modules[\\/](@tanstack|zustand|axios)[\\/]/.test(id)) {
            return 'vendor-data';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Cookies matter now that the refresh token is httpOnly: proxying keeps
      // the frontend and API on the same origin in dev, so sameSite=strict works.
      '/api': 'http://localhost:4000',
      // Local file uploads (logos, avatars) are served by Express from
      // backend/uploads/. Without this proxy, /uploads/logos/uuid.png hits
      // the Vite dev server instead of the backend and returns a 404.
      '/uploads': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
