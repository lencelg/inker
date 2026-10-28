import { afterEach, describe, expect, it } from 'vitest';
import { restoreSettingsFocus } from './focus';

afterEach(() => {
  document.body.replaceChildren();
});

describe('restoreSettingsFocus', () => {
  it('focuses the previously active settings control', () => {
    document.body.innerHTML = `
      <button id="previous">Previous</button>
      <section class="settings-panel" tabindex="-1"></section>
    `;
    const previous = document.getElementById(
      'previous',
    ) as HTMLButtonElement;

    restoreSettingsFocus(previous);

    expect(document.activeElement).toBe(previous);
  });

  it('falls back to the settings panel when the previous element is gone', () => {
    document.body.innerHTML = `
      <button id="previous">Previous</button>
      <section class="settings-panel" tabindex="-1"></section>
    `;
    const previous = document.getElementById(
      'previous',
    ) as HTMLButtonElement;
    const panel = document.querySelector(
      '.settings-panel',
    ) as HTMLElement;
    previous.remove();

    restoreSettingsFocus(previous);

    expect(document.activeElement).toBe(panel);
  });
});
