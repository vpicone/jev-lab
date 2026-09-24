'use client';

import { useState } from 'react';
import { PRESETS } from '@/lib/presets';
import { evaluateJev, evaluateLlm, fmtPerMillion, fmtUsd, stringifyState } from '@/lib/client';
import type { Answer, EvalResponse, Questions } from '@/lib/types';
import { AnswerView } from './AnswerView';
import { Code, stateLang } from './Code';
import { Button, ErrorBox, Panel, Stat } from './ui';

const LLMS = [
  { id: 'google/gemini-2.5-flash-lite', label: 'google/gemini-2.5-flash-lite' },
  { id: 'openai/gpt-5.4-nano', label: 'openai/gpt-5.4-nano' },
  { id: 'openai/gpt-5-nano', label: 'openai/gpt-5-nano (reasoning, slow)' },
  { id: 'anthropic/claude-haiku-4.5', label: 'anthropic/claude-haiku-4.5 (paid credits)' },
  { id: 'anthropic/claude-sonnet-5', label: 'anthropic/claude-sonnet-5 (paid credits)' },
];

type Side = { runs: EvalResponse[]; error?: string };

const headline = (a: Answer) => (a.type === 'choice' ? a.choice : a.type === 'score' ? a.score.toFixed(2) : a.probability.toFixed(2));

function spread(runs: EvalResponse[], id: string) {
  const values = runs.map((r) => r.answers[id]).filter(Boolean);
  if (values.length < 2) return null;
  if (values[0].type === 'choice') {
    const picks = new Set(values.map((v) => (v as { choice: string }).choice));
    return picks.size === 1 ? 'same pick every run' : `${picks.size} different picks`;
  }
  const nums = values.map((v) => (v.type === 'score' ? v.score : (v as { probability: number }).probability));
  return `range ${(Math.max(...nums) - Math.min(...nums)).toFixed(2)}`;
}

function SideView({ title, side, questions }: { title: string; side?: Side; questions: Questions }) {
  const runs = side?.runs ?? [];
  const avg = (f: (r: EvalResponse) => number | undefined) => {
    const xs = runs.map(f).filter((x): x is number => x !== undefined);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
  };
  const latency = avg((r) => r.latencyMs);
  const modelMs = avg((r) => r.providerMs);
  const cost = avg((r) => r.costUsd);
  return (
    <Panel title={title}>
      {side?.error && <ErrorBox message={side.error} />}
      {!side && <p className="text-sm text-muted">Not run yet.</p>}
      {runs.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Avg latency"
              value={latency ? `${Math.round(latency)} ms${modelMs ? ` (${Math.round(modelMs)} model)` : ''}` : '—'}
              hint="Round trip; in parentheses, time spent at the model provider"
            />
            <Stat label="Tokens in/out" value={`${runs[0].usage.inputTokens ?? '—'} / ${runs[0].usage.outputTokens ?? '—'}`} />
            <Stat label="Avg cost" value={fmtUsd(cost)} />
            <Stat label="At scale" value={fmtPerMillion(cost)} />
          </div>
          {Object.entries(questions).map(([id, q]) => {
            const s = spread(runs, id);
            return (
              <div key={id} className="space-y-1.5 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-semibold">{id}</span>
                  {runs.length > 1 && (
                    <span className="font-mono text-xs text-muted">
                      runs: {runs.map((r) => (r.answers[id] ? headline(r.answers[id]) : '?')).join(' · ')} {s && `(${s})`}
                    </span>
                  )}
                </div>
                {runs[0].answers[id] && <AnswerView question={q} answer={runs[0].answers[id]} confidence={runs[0].confidence?.[id]} />}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function Compare() {
  const [presetId, setPresetId] = useState(PRESETS[1].id);
  const [model, setModel] = useState(LLMS[0].id);
  const [repeats, setRepeats] = useState(3);
  const [running, setRunning] = useState(false);
  const [jev, setJev] = useState<Side>();
  const [llm, setLlm] = useState<Side>();
  const preset = PRESETS.find((p) => p.id === presetId)!;

  const runSide = async (fn: () => Promise<EvalResponse>): Promise<Side> => {
    try {
      return { runs: await Promise.all(Array.from({ length: repeats }, fn)) };
    } catch (e) {
      return { runs: [], error: (e as Error).message };
    }
  };

  const run = async () => {
    setRunning(true);
    setJev(undefined);
    setLlm(undefined);
    const body = { state: preset.state, questions: preset.questions };
    await Promise.all([
      runSide(() => evaluateJev(body)).then(setJev),
      runSide(() => evaluateLlm({ ...body, model })).then(setLlm),
    ]);
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Jev vs an LLM on the same decision"
        actions={
          <>
            <select className="px-2 py-1 text-xs" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <select className="px-2 py-1 text-xs" value={model} onChange={(e) => setModel(e.target.value)}>
              {LLMS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <select className="px-2 py-1 text-xs" value={repeats} onChange={(e) => setRepeats(Number(e.target.value))}>
              {[1, 3, 5].map((n) => (
                <option key={n} value={n}>
                  ×{n}
                </option>
              ))}
            </select>
            <Button onClick={run} disabled={running}>
              {running ? 'Running…' : 'Run both'}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-muted">
          Both sides get the same state and questions. The LLM uses structured output and is asked to state its own probabilities; Jev’s come from
          the model itself. Repeat runs show how stable each side is.
        </p>
        <Code
          code={stringifyState(preset.state)}
          lang={stateLang(preset.state)}
          className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-panel-2 p-2 text-xs"
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <SideView title="typesafe-ai/jev" side={jev} questions={preset.questions} />
        <SideView title={model} side={llm} questions={preset.questions} />
      </div>
    </div>
  );
}
