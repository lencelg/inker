import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from './useAutoSave';

interface TestTab {
  path: string;
  content: string;
  savedContent: string;
}

function createAutoSave(
  overrides: {
    enabled?: () => boolean;
    blocked?: () => boolean;
    isImage?: (path: string) => boolean;
    tab?: TestTab;
    save?: (path: string) => Promise<boolean>;
  } = {},
) {
  const tab = overrides.tab ?? {
    path: 'a.md',
    content: 'local',
    savedContent: 'saved',
  };
  const save = vi.fn(
    overrides.save ??
      (async () => {
        tab.savedContent = tab.content;
        return true;
      }),
  );

  const autoSave = useAutoSave({
    enabled: overrides.enabled ?? (() => true),
    delay: () => 100,
    getTab: (path) => (path === tab.path ? tab : undefined),
    isImage: overrides.isImage ?? (() => false),
    isBlocked: overrides.blocked ?? (() => false),
    save,
  });

  return { autoSave, tab, save };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoSave', () => {
  it('saves a dirty tab after the configured delay', async () => {
    vi.useFakeTimers();
    const { autoSave, tab, save } = createAutoSave();

    autoSave.schedule(tab.path);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(tab.path);
  });

  it('cancels a pending save', async () => {
    vi.useFakeTimers();
    const { autoSave, tab, save } = createAutoSave();

    autoSave.schedule(tab.path);
    autoSave.cancel(tab.path);
    await vi.advanceTimersByTimeAsync(100);

    expect(save).not.toHaveBeenCalled();
  });

  it('retries when a modal blocks saving', async () => {
    vi.useFakeTimers();
    let blocked = true;
    const { autoSave, tab, save } = createAutoSave({
      blocked: () => blocked,
    });

    autoSave.schedule(tab.path);
    await vi.advanceTimersByTimeAsync(100);
    expect(save).not.toHaveBeenCalled();

    blocked = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('ignores clean tabs, images, and disabled auto-save', async () => {
    vi.useFakeTimers();

    const clean = createAutoSave({
      tab: { path: 'a.md', content: 'same', savedContent: 'same' },
    });
    clean.autoSave.schedule('a.md');
    await vi.advanceTimersByTimeAsync(100);
    expect(clean.save).not.toHaveBeenCalled();

    const image = createAutoSave({ isImage: () => true });
    image.autoSave.schedule('a.md');
    await vi.advanceTimersByTimeAsync(100);
    expect(image.save).not.toHaveBeenCalled();

    const disabled = createAutoSave({ enabled: () => false });
    disabled.autoSave.schedule('a.md');
    await vi.advanceTimersByTimeAsync(100);
    expect(disabled.save).not.toHaveBeenCalled();
  });

  it('reschedules when content changes during a save', async () => {
    vi.useFakeTimers();
    let saves = 0;
    const { autoSave, tab, save } = createAutoSave({
      save: async () => {
        saves += 1;
        if (saves === 1) {
          tab.savedContent = 'first snapshot';
          tab.content = 'second snapshot';
          return true;
        }
        tab.savedContent = tab.content;
        return true;
      },
    });

    autoSave.schedule(tab.path);
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
