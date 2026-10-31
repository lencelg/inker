export interface VimExContext {
  save: () => void;
  pasteImage: () => void;
  openNote: (path: string | null) => void;
  closeTab: (force: boolean) => void;
  saveAndCloseTab: () => void;
  switchTab: (direction: 1 | -1) => void;
  resolveNotePath: (input: string) => string | null;
}

export interface VimExCommand {
  name: string;
  prefix?: string;
  run: (context: VimExContext, params: { argString?: string }) => void;
}

export const APP_VIM_EX_COMMANDS: readonly VimExCommand[] = [
  { name: 'write', prefix: 'w', run: (context) => context.save() },
  {
    name: 'pasteimage',
    prefix: 'pa',
    run: (context) => context.pasteImage(),
  },
  {
    name: 'edit',
    prefix: 'e',
    run: (context, params) =>
      context.openNote(context.resolveNotePath(params.argString ?? '')),
  },
  {
    name: 'quit',
    prefix: 'q',
    run: (context, params) =>
      context.closeTab((params.argString ?? '').trim() === '!'),
  },
  {
    name: 'wq',
    prefix: 'wq',
    run: (context) => context.saveAndCloseTab(),
  },
  {
    name: 'xit',
    prefix: 'x',
    run: (context) => context.saveAndCloseTab(),
  },
  { name: 'bnext', prefix: 'bn', run: (context) => context.switchTab(1) },
  {
    name: 'bprevious',
    prefix: 'bp',
    run: (context) => context.switchTab(-1),
  },
];

const CORE_VIM_EX_COMMANDS: readonly string[] = [
  'colorscheme',
  'map',
  'imap',
  'nmap',
  'vmap',
  'omap',
  'noremap',
  'nnoremap',
  'vnoremap',
  'inoremap',
  'onoremap',
  'unmap',
  'mapclear',
  'nmapclear',
  'vmapclear',
  'imapclear',
  'omapclear',
  'undo',
  'redo',
  'set',
  'setlocal',
  'setglobal',
  'sort',
  'substitute',
  'startinsert',
  'nohlsearch',
  'yank',
  'put',
  'delmarks',
  'marks',
  'registers',
  'vglobal',
  'delete',
  'join',
  'normal',
  'global',
  'version',
];

export const VIM_EX_COMPLETION_NAMES: readonly string[] = [
  ...CORE_VIM_EX_COMMANDS,
  // 'wq' is intentionally omitted so :w + Tab completes to 'write' rather
  // than to a save-and-close command that would be surprising.
  ...APP_VIM_EX_COMMANDS.map((command) => command.name).filter(
    (name) => name !== 'wq',
  ),
];
