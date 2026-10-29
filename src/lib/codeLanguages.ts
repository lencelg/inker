export interface CodeLanguage {
  id: string;
  label: string;
  aliases: readonly string[];
  load: () => Promise<unknown>;
}

export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  { id: 'javascript', label: 'JavaScript', aliases: ['js', 'mjs', 'cjs'], load: () => import('@shikijs/langs/javascript') },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts'], load: () => import('@shikijs/langs/typescript') },
  { id: 'tsx', label: 'TSX', aliases: [], load: () => import('@shikijs/langs/tsx') },
  { id: 'jsx', label: 'JSX', aliases: [], load: () => import('@shikijs/langs/jsx') },
  { id: 'json', label: 'JSON', aliases: [], load: () => import('@shikijs/langs/json') },
  { id: 'jsonc', label: 'JSONC', aliases: [], load: () => import('@shikijs/langs/jsonc') },
  { id: 'html', label: 'HTML', aliases: ['htm'], load: () => import('@shikijs/langs/html') },
  { id: 'css', label: 'CSS', aliases: [], load: () => import('@shikijs/langs/css') },
  { id: 'scss', label: 'SCSS', aliases: [], load: () => import('@shikijs/langs/scss') },
  { id: 'less', label: 'Less', aliases: [], load: () => import('@shikijs/langs/less') },
  { id: 'markdown', label: 'Markdown', aliases: ['md'], load: () => import('@shikijs/langs/markdown') },
  { id: 'shellscript', label: 'Shell', aliases: ['sh', 'bash', 'shell', 'zsh'], load: () => import('@shikijs/langs/shellscript') },
  { id: 'python', label: 'Python', aliases: ['py'], load: () => import('@shikijs/langs/python') },
  { id: 'rust', label: 'Rust', aliases: ['rs'], load: () => import('@shikijs/langs/rust') },
  { id: 'go', label: 'Go', aliases: ['golang'], load: () => import('@shikijs/langs/go') },
  { id: 'java', label: 'Java', aliases: [], load: () => import('@shikijs/langs/java') },
  { id: 'c', label: 'C', aliases: [], load: () => import('@shikijs/langs/c') },
  { id: 'cpp', label: 'C++', aliases: ['c++', 'cc', 'hpp'], load: () => import('@shikijs/langs/cpp') },
  { id: 'csharp', label: 'C#', aliases: ['c#', 'cs'], load: () => import('@shikijs/langs/csharp') },
  { id: 'php', label: 'PHP', aliases: [], load: () => import('@shikijs/langs/php') },
  { id: 'ruby', label: 'Ruby', aliases: ['rb'], load: () => import('@shikijs/langs/ruby') },
  { id: 'swift', label: 'Swift', aliases: [], load: () => import('@shikijs/langs/swift') },
  { id: 'kotlin', label: 'Kotlin', aliases: ['kt'], load: () => import('@shikijs/langs/kotlin') },
  { id: 'sql', label: 'SQL', aliases: [], load: () => import('@shikijs/langs/sql') },
  { id: 'yaml', label: 'YAML', aliases: ['yml'], load: () => import('@shikijs/langs/yaml') },
  { id: 'toml', label: 'TOML', aliases: [], load: () => import('@shikijs/langs/toml') },
  { id: 'xml', label: 'XML', aliases: [], load: () => import('@shikijs/langs/xml') },
  { id: 'dockerfile', label: 'Dockerfile', aliases: ['docker'], load: () => import('@shikijs/langs/dockerfile') },
  { id: 'diff', label: 'Diff', aliases: ['patch'], load: () => import('@shikijs/langs/diff') },
  { id: 'graphql', label: 'GraphQL', aliases: ['gql'], load: () => import('@shikijs/langs/graphql') },
  { id: 'lua', label: 'Lua', aliases: [], load: () => import('@shikijs/langs/lua') },
  { id: 'r', label: 'R', aliases: [], load: () => import('@shikijs/langs/r') },
  { id: 'perl', label: 'Perl', aliases: ['pl'], load: () => import('@shikijs/langs/perl') },
  { id: 'objective-c', label: 'Objective-C', aliases: ['objc', 'objectivec'], load: () => import('@shikijs/langs/objective-c') },
  { id: 'makefile', label: 'Makefile', aliases: ['make'], load: () => import('@shikijs/langs/makefile') },
  { id: 'ini', label: 'INI', aliases: ['properties'], load: () => import('@shikijs/langs/ini') },
];

const BY_ID = new Map(CODE_LANGUAGES.map((language) => [language.id, language]));
const BY_ALIAS = new Map<string, CodeLanguage>();
for (const language of CODE_LANGUAGES) {
  BY_ALIAS.set(language.id.toLowerCase(), language);
  for (const alias of language.aliases) {
    BY_ALIAS.set(alias.toLowerCase(), language);
  }
}

const PLAIN_ALIASES = new Set(['', 'text', 'plain', 'plaintext', 'txt', 'none']);

export function resolveCodeLanguage(
  info: string,
): CodeLanguage | null {
  const value = info.trim().toLowerCase().replace(/^language-/, '');
  if (PLAIN_ALIASES.has(value)) return null;
  return BY_ALIAS.get(value) ?? null;
}

export function displayLanguage(info: string): string {
  const resolved = resolveCodeLanguage(info);
  return resolved?.label ?? info.trim().split(/\s+/)[0] ?? 'text';
}

export function extractFenceLanguages(markdown: string): string[] {
  const result = new Set<string>();
  const fence = /(?:^|\n)\s*(?:```|~~~)\s*([^\s`]*)/g;
  for (const match of markdown.matchAll(fence)) {
    const language = resolveCodeLanguage(match[1] ?? '');
    if (language && language.id !== 'mermaid') result.add(language.id);
  }
  return [...result];
}

export function preloadLanguageList(): CodeLanguage[] {
  return [...CODE_LANGUAGES];
}
