'use client';

import { useState } from 'react';
import type { JsonValue, Questions } from '@/lib/types';
import { Code } from './Code';

function tsLiteral(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((v) => inner + tsLiteral(v, indent + 1)).join(',\n')},\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([k, v]) => `${inner}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${tsLiteral(v, indent + 1)}`)
      .join(',\n')},\n${pad}}`;
  }
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return JSON.stringify(value);
}

export function CodeView({ state, questions }: { state: JsonValue; questions: Questions }) {
  const [tab, setTab] = useState<'ts' | 'curl'>('ts');
  const [copied, setCopied] = useState(false);

  const ts = `import { experimental_evaluate as evaluate } from 'ai';

const result = await evaluate({
  model: 'typesafe-ai/jev',
  state: ${tsLiteral(state, 1)},
  questions: ${tsLiteral(questions, 1)},
});

console.log(result.answers);
console.log(result.providerMetadata?.typesafe?.confidence);`;

  const curl = `curl https://ai-gateway.vercel.sh/v1/evaluate \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ model: 'typesafe-ai/jev', state, questions }, null, 2).replace(/'/g, "'\\''")}'`;

  const code = tab === 'ts' ? ts : curl;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-xs">
        {(['ts', 'curl'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-1 ${tab === t ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}`}
          >
            {t === 'ts' ? 'AI SDK' : 'HTTP'}
          </button>
        ))}
        <button
          className="ml-auto rounded px-2 py-1 text-muted hover:text-fg"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <Code code={code} lang={tab === 'ts' ? 'ts' : 'bash'} className="max-h-96 overflow-auto rounded-md bg-panel-2 p-3 text-[11px] leading-relaxed" />
    </div>
  );
}
