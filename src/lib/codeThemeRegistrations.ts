import type { ThemeRegistrationAny } from '@shikijs/types';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import githubDarkDimmed from '@shikijs/themes/github-dark-dimmed';
import githubDarkHighContrast from '@shikijs/themes/github-dark-high-contrast';
import oneDarkPro from '@shikijs/themes/one-dark-pro';
import oneLight from '@shikijs/themes/one-light';
import monokai from '@shikijs/themes/monokai';
import nord from '@shikijs/themes/nord';
import dracula from '@shikijs/themes/dracula';
import solarizedDark from '@shikijs/themes/solarized-dark';
import solarizedLight from '@shikijs/themes/solarized-light';
import gruvboxDarkMedium from '@shikijs/themes/gruvbox-dark-medium';
import tokyoNight from '@shikijs/themes/tokyo-night';
import minLight from '@shikijs/themes/min-light';
import darkPlus from '@shikijs/themes/dark-plus';

export type BuiltInCodeThemeId =
  | 'github-dark'
  | 'github-light'
  | 'atom-one-dark'
  | 'monokai'
  | 'nord'
  | 'tokyo-night'
  | 'vs-dark'
  | 'atom-one-light'
  | 'github-dark-dimmed'
  | 'dracula'
  | 'solarized-dark'
  | 'solarized-light'
  | 'gruvbox-dark'
  | 'tokyo-night-light'
  | 'github-dark-high-contrast';

export interface BuiltInCodeThemeRegistration {
  id: BuiltInCodeThemeId;
  label: string;
  theme: ThemeRegistrationAny;
}

export const BUILTIN_CODE_THEME_REGISTRATIONS: readonly BuiltInCodeThemeRegistration[] = [
  { id: 'github-dark', label: 'GitHub Dark', theme: githubDark },
  { id: 'github-light', label: 'GitHub Light', theme: githubLight },
  { id: 'atom-one-dark', label: 'Atom One Dark', theme: oneDarkPro },
  { id: 'monokai', label: 'Monokai', theme: monokai },
  { id: 'nord', label: 'Nord', theme: nord },
  { id: 'tokyo-night', label: 'Tokyo Night', theme: tokyoNight },
  { id: 'vs-dark', label: 'VS Dark', theme: darkPlus },
  { id: 'atom-one-light', label: 'Atom One Light', theme: oneLight },
  {
    id: 'github-dark-dimmed',
    label: 'GitHub Dark Dimmed',
    theme: githubDarkDimmed,
  },
  { id: 'dracula', label: 'Dracula', theme: dracula },
  { id: 'solarized-dark', label: 'Solarized Dark', theme: solarizedDark },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    theme: solarizedLight,
  },
  { id: 'gruvbox-dark', label: 'Gruvbox Dark', theme: gruvboxDarkMedium },
  { id: 'tokyo-night-light', label: 'Min Light', theme: minLight },
  {
    id: 'github-dark-high-contrast',
    label: 'GitHub Dark High Contrast',
    theme: githubDarkHighContrast,
  },
];
