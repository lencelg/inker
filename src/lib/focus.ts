export function restoreSettingsFocus(
  previous: HTMLElement | null,
): void {
  const target =
    previous &&
    previous !== document.body &&
    previous.isConnected
      ? previous
      : document.querySelector<HTMLElement>('.settings-panel');
  target?.focus();
}
