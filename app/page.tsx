'use client';

import { useState } from 'react';
import { Playground } from '@/components/Playground';
import { Experiments } from '@/components/Experiments';
import { Calibration } from '@/components/Calibration';
import { Compare } from '@/components/Compare';
import { Guide } from '@/components/Guide';
import { RateLimitBadge } from '@/components/RateLimit';

const TABS = [
  { id: 'guide', label: 'Guide', Component: Guide },
  { id: 'playground', label: 'Playground', Component: Playground },
  { id: 'experiments', label: 'Experiments', Component: Experiments },
  { id: 'calibration', label: 'Calibration', Component: Calibration },
  { id: 'compare', label: 'Jev vs LLM', Component: Compare },
] as const;

export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('playground');

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jev Lab</h1>
          <p className="text-sm text-muted">
            Test how Jev classifies, scores and verifies, and how confident it is.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RateLimitBadge />
          <nav className="flex gap-1 rounded-lg border border-border bg-panel p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      {TABS.map(({ id, Component }) => (
        <div key={id} hidden={tab !== id}>
          <Component />
        </div>
      ))}
    </div>
  );
}
