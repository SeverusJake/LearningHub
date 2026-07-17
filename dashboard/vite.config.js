import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The dashboard imports markdown from the repo root, one level up.
      allow: ['..'],
    },
  },
});
