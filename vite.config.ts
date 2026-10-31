import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import type { Plugin } from 'vite';

const LEGACY_FONT_SOURCE =
  /,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\((['"])(?:woff|truetype)\1\)/gi;

/**
 * Keep only woff2 font sources. Every target WebView (WebKitGTK, WebView2,
 * WKWebView) supports woff2, and the woff/ttf fallbacks roughly triple the
 * bundled font payload.
 */
function woff2OnlyFonts(): Plugin {
  return {
    name: 'inker-woff2-only-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('.css')) return null;
      const next = code.replace(LEGACY_FONT_SOURCE, '');
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  plugins: [woff2OnlyFonts(), vue()],
  clearScreen: false,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Shiki initializes a WASM engine; keep worker concurrency bounded so
    // highlighting tests do not race on engine startup.
    maxWorkers: 4,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
