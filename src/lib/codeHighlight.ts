import {
  codeThemeById,
  DEFAULT_CODE_THEME,
  type CodeThemeId,
} from './codeThemes';
import {
  tokenLinesToRanges,
  type TokenRange,
} from './codeRender';
import { tokenizeSync } from './shikiHighlighter';

export type CodeHighlightRange = TokenRange;

export function codeHighlightRanges(
  text: string,
  language = '',
  theme: CodeThemeId = DEFAULT_CODE_THEME,
): CodeHighlightRange[] {
  if (!text) return [];
  const tokens = tokenizeSync(text, language, codeThemeById(theme));
  return tokens ? tokenLinesToRanges(tokens) : [];
}
