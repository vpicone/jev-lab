import type { HighlighterCore } from 'shiki/core';

export type CodeLang = 'ts' | 'json' | 'bash' | 'text';

let highlighter: Promise<HighlighterCore> | undefined;

function getHighlighter() {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ]);
    return createHighlighterCore({
      themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark-default.mjs')],
      langs: [import('shiki/langs/typescript.mjs'), import('shiki/langs/json.mjs'), import('shiki/langs/shellscript.mjs')],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return highlighter;
}

const LANG_IDS: Record<Exclude<CodeLang, 'text'>, string> = { ts: 'typescript', json: 'json', bash: 'shellscript' };

/** Returns the inner HTML of shiki's <code> element, colored through --shiki-light / --shiki-dark variables. */
export async function highlightToHtml(code: string, lang: CodeLang): Promise<string | null> {
  if (lang === 'text') return null;
  const h = await getHighlighter();
  const html = h.codeToHtml(code, {
    lang: LANG_IDS[lang],
    themes: { light: 'github-light', dark: 'github-dark-default' },
    defaultColor: false,
  });
  const match = html.match(/<code>([\s\S]*)<\/code>/);
  return match ? match[1] : null;
}
