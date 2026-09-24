'use client';

import { useEffect, useRef, useState } from 'react';
import { highlightToHtml, type CodeLang } from '@/lib/highlight';
import type { JsonValue } from '@/lib/types';

export const stateLang = (state: JsonValue): CodeLang => (typeof state === 'string' ? 'text' : 'json');

function useHighlighted(code: string, lang: CodeLang) {
  const [result, setResult] = useState<{ code: string; lang: CodeLang; html: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    highlightToHtml(code, lang)
      .then((html) => !cancelled && setResult({ code, lang, html }))
      .catch(() => !cancelled && setResult({ code, lang, html: null }));
    return () => {
      cancelled = true;
    };
  }, [code, lang]);
  return result && result.code === code && result.lang === lang ? result.html : null;
}

export function Code({ code, lang, className = '' }: { code: string; lang: CodeLang; className?: string }) {
  const html = useHighlighted(code, lang);
  return (
    <pre className={`shiki-code font-mono ${className}`}>
      {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
    </pre>
  );
}

export function CodeEditor({
  value,
  onChange,
  lang,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  lang: CodeLang;
  className?: string;
}) {
  const html = useHighlighted(value, lang);
  const backdrop = useRef<HTMLPreElement>(null);
  const shared = 'm-0 whitespace-pre-wrap break-words p-2 font-mono text-xs leading-relaxed [scrollbar-gutter:stable]';

  return (
    <div className="relative">
      <pre
        ref={backdrop}
        aria-hidden
        className={`shiki-code pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent bg-panel-2 ${shared}`}
      >
        {/* A trailing newline would otherwise collapse and misalign the last line. */}
        {html ? <code dangerouslySetInnerHTML={{ __html: html + (value.endsWith('\n') ? ' ' : '') }} /> : <code>{value + ' '}</code>}
      </pre>
      <textarea
        className={`relative block w-full resize-y overflow-y-auto !bg-transparent !text-transparent caret-fg selection:bg-accent/30 ${shared} ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
        }}
        spellCheck={false}
      />
    </div>
  );
}
