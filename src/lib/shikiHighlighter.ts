import { ref, type Ref } from 'vue';
import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import type {
  HighlighterCore,
  ThemeRegistrationAny,
} from '@shikijs/types';
import {
  CODE_LANGUAGES,
  resolveCodeLanguage,
} from './codeLanguages';
import { BUILTIN_CODE_THEME_REGISTRATIONS } from './codeThemeRegistrations';
import {
  renderTokensToHtml,
  tokensFromShiki,
  type CodeTokenLines,
} from './codeRender';
import { classifyToken } from './semanticTokens';

export interface HighlightTheme {
  id: string;
  foreground: string;
  shikiTheme: ThemeRegistrationAny;
  shikiThemeName: string;
}

const MAX_CODE_CHARS = 200_000;
const MAX_CODE_LINES = 5_000;
const MAX_LINE_CHARS = 5_000;
const MAX_CACHE_ENTRIES = 200;
const CORE_LANGUAGES = ['javascript', 'typescript', 'json', 'markdown', 'shellscript'];

export const highlightReady = ref(false);
export const highlightRevision = ref(0);

let highlighter: HighlighterCore | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
let activeTheme: HighlightTheme | null = null;
const languagePromises = new Map<string, Promise<boolean>>();
const themePromises = new Map<string, Promise<string | null>>();
const tokenCache = new Map<string, CodeTokenLines>();

function languageById(id: string) {
  return CODE_LANGUAGES.find((language) => language.id === id) ?? null;
}

function bumpRevision(): void {
  highlightRevision.value += 1;
}

export function getShiki(): HighlighterCore | null {
  return highlighter;
}

export function highlightFenceHtml(
  code: string,
  language: string,
  theme: HighlightTheme,
): string | null {
  const tokens = tokenizeSync(code, language, theme);
  return tokens ? renderTokensToHtml(tokens, theme.foreground) : null;
}

export async function initShiki(
  themes?: readonly ThemeRegistrationAny[],
): Promise<void> {
  if (initPromise) return initPromise;
  if (highlighter && initialized) return;

  initPromise = (async () => {
    const registrations =
      themes ??
      BUILTIN_CODE_THEME_REGISTRATIONS.map(
        (registration) => registration.theme,
      );

    highlighter = await createHighlighterCore({
      themes: [...registrations],
      langs: [],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
    highlightReady.value = true;
    bumpRevision();

    if (activeTheme) {
      void ensureShikiTheme(activeTheme);
    }
    await Promise.all(CORE_LANGUAGES.map((id) => ensureShikiLanguage(id)));
    initialized = true;
  })()
    .catch(() => {
      highlightReady.value = false;
      initialized = false;
      highlighter = null;
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}

export async function ensureShikiLanguage(
  languageId: string,
): Promise<boolean> {
  const language = resolveCodeLanguage(languageId) ?? languageById(languageId);
  if (!language) return false;

  if (highlighter?.getLoadedLanguages().includes(language.id)) {
    return true;
  }
  const existing = languagePromises.get(language.id);
  if (existing) return existing;

  const promise = (async () => {
    if (!highlighter) await initShiki();
    if (!highlighter) return false;
    if (highlighter.getLoadedLanguages().includes(language.id)) return true;
    try {
      await highlighter.loadLanguage(
        language.load as unknown as () => Promise<any>,
      );
      bumpRevision();
      return true;
    } catch {
      return false;
    }
  })().then((loaded) => {
    if (!loaded) languagePromises.delete(language.id);
    return loaded;
  });

  languagePromises.set(language.id, promise);
  return promise;
}

export async function ensureShikiTheme(
  theme: HighlightTheme,
): Promise<string | null> {
  if (!highlighter) await initShiki();
  if (!highlighter) return null;

  const name = theme.shikiThemeName;
  if (highlighter.getLoadedThemes().includes(name)) return name;

  const existing = themePromises.get(name);
  if (existing) return existing;

  const promise = (async () => {
    try {
      await highlighter?.loadTheme(theme.shikiTheme);
      bumpRevision();
      return name;
    } catch {
      return null;
    }
  })();
  themePromises.set(name, promise);
  return promise;
}

export function useCodeTheme(theme: HighlightTheme): void {
  activeTheme = theme;
  void ensureShikiTheme(theme);
}

function shouldSkip(code: string): boolean {
  if (code.length > MAX_CODE_CHARS) return true;
  const lines = code.split('\n');
  return (
    lines.length > MAX_CODE_LINES ||
    lines.some((line) => line.length > MAX_LINE_CHARS)
  );
}

function cacheKey(
  code: string,
  language: string,
  theme: HighlightTheme,
): string {
  return `${theme.shikiThemeName}\u0000${language}\u0000${code}`;
}

export function tokenizeSync(
  code: string,
  languageId: string,
  theme: HighlightTheme,
): CodeTokenLines | null {
  const language = resolveCodeLanguage(languageId) ?? languageById(languageId);
  if (!language || !highlighter || shouldSkip(code)) return null;

  if (!highlighter.getLoadedLanguages().includes(language.id)) {
    void ensureShikiLanguage(language.id);
    return null;
  }
  if (!highlighter.getLoadedThemes().includes(theme.shikiThemeName)) {
    void ensureShikiTheme(theme);
    return null;
  }

  const key = cacheKey(code, language.id, theme);
  const cached = tokenCache.get(key);
  if (cached) return cached;

  const options = {
    lang: language.id,
    theme: theme.shikiThemeName,
    tokenizeMaxLineLength: MAX_LINE_CHARS,
    tokenizeTimeLimit: 100,
  } as const;
  try {
    let result;
    try {
      result = highlighter.codeToTokens(code, {
        ...options,
        includeExplanation: 'scopeName',
      });
    } catch {
      // Some Shiki JavaScript-engine grammars fail while building scope
      // explanations; colors are still usable without them.
      result = highlighter.codeToTokens(code, options);
    }
    const tokens = tokensFromShiki(result.tokens, classifyToken);
    tokenCache.set(key, tokens);
    if (tokenCache.size > MAX_CACHE_ENTRIES) {
      const oldest = tokenCache.keys().next().value;
      if (oldest) tokenCache.delete(oldest);
    }
    return tokens;
  } catch {
    return null;
  }
}
