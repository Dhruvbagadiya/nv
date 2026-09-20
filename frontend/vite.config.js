import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // The @/ alias shadcn components import through. Declared here for the
      // bundler AND in tsconfig.json for the editor — the two do not read each
      // other, so leaving either out breaks half the toolchain.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
    /*
     * Poll for file changes instead of relying on filesystem events.
     *
     * This repo lives on /mnt/c — a Windows drive mounted into WSL. Windows does
     * not forward inotify events across that boundary, so Vite's watcher sees
     * NOTHING: `npm run dev` starts fine, serves the version of each module that
     * existed at boot, and then silently ignores every subsequent edit. The
     * symptom is maddening because nothing errors — the page just never changes,
     * and only a full restart of the dev server picks anything up.
     *
     * Polling costs a little CPU and is the standard fix for this mount. If the
     * project ever moves onto the WSL filesystem proper (~/...), this can go.
     */
    watch: { usePolling: true, interval: 300 },
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

  /*
   * `vite preview` serves the production build but does NOT inherit the dev
   * server's proxy — they are separate config blocks. Without this, every
   * /api/* call from a preview build 404s or 500s against the static server,
   * which is why previewing the site fills the console with
   * "POST /api/auth/refresh 500" and no logged-in state ever works.
   *
   * Same targets as `server.proxy` above, deliberately: preview is only useful
   * as a check on the real build if it talks to the same backend dev does.
   */
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },

  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
});
