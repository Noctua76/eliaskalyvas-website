import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || '/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
        gr: resolve(import.meta.dirname, 'gr/index.html'),
        enBook: resolve(import.meta.dirname, 'en/book/index.html'),
        grBook: resolve(import.meta.dirname, 'gr/book/index.html'),
        enAdmin: resolve(import.meta.dirname, 'en/admin/index.html'),
        grAdmin: resolve(import.meta.dirname, 'gr/admin/index.html'),
      },
    },
  },
});
