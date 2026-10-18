declare module 'katex/dist/contrib/auto-render.js' {
  import { KatexOptions } from 'katex';

  interface Delimiter {
    left: string;
    right: string;
    display: boolean;
  }

  interface AutoRenderOptions extends KatexOptions {
    delimiters?: Delimiter[];
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
    preProcess?: (math: string) => string;
  }

  function renderMathInElement(elem: HTMLElement, options?: AutoRenderOptions): void;
  export default renderMathInElement;
}

declare module 'katex/contrib/auto-render' {
  import { KatexOptions } from 'katex';

  interface Delimiter {
    left: string;
    right: string;
    display: boolean;
  }

  interface AutoRenderOptions extends KatexOptions {
    delimiters?: Delimiter[];
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
    preProcess?: (math: string) => string;
  }

  function renderMathInElement(elem: HTMLElement, options?: AutoRenderOptions): void;
  export default renderMathInElement;
}
