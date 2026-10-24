declare module 'katex/contrib/auto-render' {
  export interface DelimiterSpec {
    left: string;
    right: string;
    display: boolean;
  }

  export interface RenderMathInElementOptions {
    delimiters?: DelimiterSpec[];
    preProcess?: (math: string) => string;
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
    displayMode?: boolean;
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    macros?: Record<string, string>;
    throwOnError?: boolean;
  }

  export default function renderMathInElement(
    elem: HTMLElement,
    options?: RenderMathInElementOptions,
  ): void;
}
