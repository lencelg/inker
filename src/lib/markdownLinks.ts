import { openUrl } from '@tauri-apps/plugin-opener';
import { fragmentFromHref } from './anchors';

export type MarkdownLinkTarget =
  | { kind: 'external'; href: string }
  | { kind: 'internal'; fragment: string }
  | { kind: 'none' };

const EXTERNAL_HREF = /^(?:https?:\/\/|mailto:)/i;

export function classifyMarkdownLink(
  href: string | null,
): MarkdownLinkTarget {
  const value = href?.trim() ?? '';
  if (!value) return { kind: 'none' };
  if (EXTERNAL_HREF.test(value)) return { kind: 'external', href: value };

  const fragment = fragmentFromHref(value);
  if (fragment === null) return { kind: 'none' };
  return { kind: 'internal', fragment };
}

function isExternalLinkOpenGesture(event: MouseEvent): boolean {
  return event.button === 0 && (event.ctrlKey || event.metaKey);
}

export function suppressLinkContextMenu(event: MouseEvent): void {
  if (
    event.target instanceof Element &&
    event.target.closest('a[href]')
  ) {
    event.preventDefault();
  }
}

export function handleMarkdownLinkClick(
  event: MouseEvent,
  anchor: Element,
): MarkdownLinkTarget {
  const link = classifyMarkdownLink(anchor.getAttribute('href'));
  event.preventDefault();

  if (link.kind === 'external' && isExternalLinkOpenGesture(event)) {
    void openUrl(link.href).catch((error) => {
      console.error('Failed to open external link', error);
    });
  }

  return link;
}
