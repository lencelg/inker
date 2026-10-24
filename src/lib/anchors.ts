export function headingSlug(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function fragmentFromHref(href: string | null): string | null {
  const value = href?.trim() ?? '';
  if (!value.startsWith('#')) return null;
  const fragment = value.slice(1);
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

export function findAnchorTarget(
  root: ParentNode,
  fragment: string,
): HTMLElement | null {
  const wanted = fragment.trim();
  if (!wanted) return null;

  const ids = Array.from(root.querySelectorAll<HTMLElement>('[id]'));
  const direct = ids.find((element) => element.id === wanted);
  if (direct) return direct;

  const wantedSlug = headingSlug(wanted);
  if (!wantedSlug) return null;

  return (
    Array.from(
      root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
    ).find(
      (heading) => headingSlug(heading.textContent ?? '') === wantedSlug,
    ) ?? null
  );
}

export function scrollToAnchor(
  root: HTMLElement,
  target: HTMLElement,
  offset = 18,
): void {
  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = root.scrollTop + targetRect.top - rootRect.top - offset;
  if (typeof root.scrollTo === 'function') {
    root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    root.scrollTop = Math.max(0, top);
  }
}
