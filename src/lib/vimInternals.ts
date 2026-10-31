import type { EditorView } from '@codemirror/view';
import { Vim } from '@replit/codemirror-vim';

export function vimViewOf(cm: unknown): EditorView | null {
  return (cm as { cm6?: EditorView } | null)?.cm6 ?? null;
}

export function vimMacroState():
  | { isRecording?: boolean; latestRegister?: string }
  | undefined {
  const globalState = (
    Vim as unknown as {
      getVimGlobalState_?: () => {
        macroModeState?: {
          isRecording?: boolean;
          latestRegister?: string;
        };
      };
    }
  ).getVimGlobalState_?.();
  return globalState?.macroModeState;
}
