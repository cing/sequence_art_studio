import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/sequence_art_studio/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
