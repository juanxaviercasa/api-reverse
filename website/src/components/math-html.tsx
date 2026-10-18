'use client';

import { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render.js';
import 'katex/dist/contrib/mhchem.js';

interface MathHtmlProps {
  html: string;
  className?: string;
  inlineDisplay?: boolean;
}

export function MathHtml({ html, className = '', inlineDisplay = false }: MathHtmlProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Set content and render math
    el.innerHTML = html;

    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: !inlineDisplay },
          { left: '\\[', right: '\\]', display: !inlineDisplay },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        errorColor: '#f43f5e',
        strict: false,
      });
    } catch (err) {
      console.warn('KaTeX render warning:', err);
    }
  }, [html, inlineDisplay]);

  return (
    <div
      ref={containerRef}
      className={`math-container ${className}`}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
