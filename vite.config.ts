import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Every folder in stories/ is a page: stories/<id>/index.html → /stories/<id>/
const stories = Object.fromEntries(
  readdirSync(resolve(__dirname, 'stories')).map((id) => [id, resolve(__dirname, 'stories', id, 'index.html')]),
);

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { rollupOptions: { input: { index: resolve(__dirname, 'index.html'), ...stories } } },
});
