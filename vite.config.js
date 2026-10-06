import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { legalStaticMarkup } from './src/legal/static-markup.js';

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || '/',
  plugins: [{
    name: 'public-legal-text',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const route = context.filename.replaceAll('\\', '/').match(/\/(gr|en)\/(privacy|terms)\/index\.html$/);
        if (!route) return html;
        return html.replace('<div id="root"></div>', `<div id="root">${legalStaticMarkup(route[1] === 'gr' ? 'el' : 'en', route[2], process.env.GITHUB_PAGES_BASE || '/')}</div>`);
      },
    },
  }],
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
        enPrivacy: resolve(import.meta.dirname, 'en/privacy/index.html'),
        grPrivacy: resolve(import.meta.dirname, 'gr/privacy/index.html'),
        enTerms: resolve(import.meta.dirname, 'en/terms/index.html'),
        grTerms: resolve(import.meta.dirname, 'gr/terms/index.html'),
      },
    },
  },
});
