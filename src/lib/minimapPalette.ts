export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface MinimapPalette {
  base: RGBColor;
  heading: RGBColor;
  code: RGBColor;
  link: RGBColor;
  quote: RGBColor;
  tag: RGBColor;
  marker: RGBColor;
  strong: RGBColor;
  emphasis: RGBColor;
  type: RGBColor;
  selection: string;
  backgroundIsLight: boolean;
}

const HEADING_NODE = /^(?:ATX|Setext)Heading[1-6]$/;
const HEX_COLOR = /^#([0-9a-f]{3,8})$/i;
const FUNCTIONAL_COLOR = /^rgba?\(\s*([^)]*)\)$/i;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseAlpha(token: string | undefined): number {
  if (!token) return 1;
  if (token.endsWith('%')) {
    const percent = Number.parseFloat(token);
    return Number.isFinite(percent) ? clamp(percent / 100, 0, 1) : 1;
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
}

function parseChannel(token: string): number {
  if (token.endsWith('%')) {
    const percent = Number.parseFloat(token);
    return Number.isFinite(percent) ? (percent / 100) * 255 : 0;
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? value : 0;
}

export function parseCssColor(value: string, fallback: RGBColor): RGBColor {
  const hex = HEX_COLOR.exec(value);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      return {
        r: Number.parseInt(digits[0] + digits[0], 16),
        g: Number.parseInt(digits[1] + digits[1], 16),
        b: Number.parseInt(digits[2] + digits[2], 16),
        a:
          digits.length === 4
            ? Number.parseInt(digits[3] + digits[3], 16) / 255
            : 1,
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: Number.parseInt(digits.slice(0, 2), 16),
        g: Number.parseInt(digits.slice(2, 4), 16),
        b: Number.parseInt(digits.slice(4, 6), 16),
        a:
          digits.length === 8
            ? Number.parseInt(digits.slice(6, 8), 16) / 255
            : 1,
      };
    }
  }

  const functional = FUNCTIONAL_COLOR.exec(value);
  if (functional) {
    const parts = functional[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      return {
        r: parseChannel(parts[0]),
        g: parseChannel(parts[1]),
        b: parseChannel(parts[2]),
        a: parseAlpha(parts[3]),
      };
    }
  }

  return fallback;
}

export function relativeLuminance(color: RGBColor): number {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

function cssColor(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

export function readMinimapPalette(): MinimapPalette {
  const styles = getComputedStyle(document.documentElement);
  const background = parseCssColor(
    cssColor(styles, '--panel', '#ffffff'),
    { r: 255, g: 255, b: 255, a: 1 },
  );
  return {
    base: parseCssColor(cssColor(styles, '--ink', '#1f2933'), {
      r: 31,
      g: 41,
      b: 51,
      a: 1,
    }),
    heading: parseCssColor(
      cssColor(styles, '--syntax-heading', '#1f4e79'),
      { r: 31, g: 78, b: 121, a: 1 },
    ),
    code: parseCssColor(cssColor(styles, '--syntax-string', '#a31515'), {
      r: 163,
      g: 21,
      b: 21,
      a: 1,
    }),
    link: parseCssColor(cssColor(styles, '--syntax-link', '#0066cc'), {
      r: 0,
      g: 102,
      b: 204,
      a: 1,
    }),
    quote: parseCssColor(cssColor(styles, '--syntax-quote', '#6b7280'), {
      r: 107,
      g: 114,
      b: 128,
      a: 1,
    }),
    tag: parseCssColor(cssColor(styles, '--syntax-tag', '#800000'), {
      r: 128,
      g: 0,
      b: 0,
      a: 1,
    }),
    marker: parseCssColor(
      cssColor(styles, '--syntax-operator', '#383a42'),
      { r: 56, g: 58, b: 66, a: 1 },
    ),
    strong: parseCssColor(cssColor(styles, '--ink', '#1f2933'), {
      r: 31,
      g: 41,
      b: 51,
      a: 1,
    }),
    emphasis: parseCssColor(cssColor(styles, '--muted', '#6b7280'), {
      r: 107,
      g: 114,
      b: 128,
      a: 1,
    }),
    type: parseCssColor(cssColor(styles, '--syntax-type', '#267f99'), {
      r: 38,
      g: 127,
      b: 153,
      a: 1,
    }),
    selection: cssColor(
      styles,
      '--editor-selection',
      'rgba(37, 99, 235, 0.18)',
    ),
    backgroundIsLight: relativeLuminance(background) > 0.55,
  };
}

export function minimapNodeColor(
  name: string,
  palette: MinimapPalette,
): RGBColor | null {
  if (HEADING_NODE.test(name)) return palette.heading;
  switch (name) {
    case 'InlineCode':
    case 'CodeText':
      return palette.code;
    case 'CodeInfo':
      return palette.type;
    case 'Link':
    case 'Image':
    case 'URL':
      return palette.link;
    case 'HTMLBlock':
    case 'HTMLTag':
      return palette.tag;
    case 'StrongEmphasis':
      return palette.strong;
    case 'Emphasis':
      return palette.emphasis;
    case 'QuoteMark':
      return palette.quote;
    case 'ListMark':
      return palette.marker;
    default:
      return null;
  }
}
