import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
