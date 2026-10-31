import { openUrl } from '@tauri-apps/plugin-opener';
import { fragmentFromHref } from './anchors';

export type MarkdownLinkTarget =
  | { kind: 'external'; href: string }
  | { kind: 'internal'; fragment: string }
  | { kind: 'none' };

const EXTERNAL_HREF = /^(?:https?:\/\/|mailto:)/i;

export function isExternalHref(href: string): boolean {
  return EXTERNAL_HREF.test(href.trim());
}

export function classifyMarkdownLink(
  href: string | null,
): MarkdownLinkTarget {
  const value = href?.trim() ?? '';
  if (!value) return { kind: 'none' };
  if (isExternalHref(value)) return { kind: 'external', href: value };

  const fragment = fragmentFromHref(value);
  if (fragment === null) return { kind: 'none' };
  return { kind: 'internal', fragment };
}

export interface ExternalLinkClick {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export function isExternalLinkOpenGesture(
  event: ExternalLinkClick,
): boolean {
  return (event.button ?? 0) === 0 && Boolean(event.ctrlKey || event.metaKey);
}

export function suppressLinkContextMenu(event: MouseEvent): void {
  if (
    event.target instanceof Element &&
    event.target.closest('a[href]')
  ) {
    event.preventDefault();
  }
}

export function openExternalLink(href: string): void {
  void openUrl(href).catch((error) => {
    console.error('Failed to open external link', error);
  });
}
