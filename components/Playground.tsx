'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRESETS } from '@/lib/presets';
import { evaluateJev, fmtPerMillion, fmtUsd, parseState, stringifyState } from '@/lib/client';
import type { EvalResponse, Questions } from '@/lib/types';
import { AnswerView } from './AnswerView';
import { Code, CodeEditor, stateLang } from './Code';
import { CodeView } from './CodeView';
import { QuestionEditor } from './QuestionEditor';
import { Button, ErrorBox, InfoTip, Panel, Stat, Tag } from './ui';

type HistoryEntry = { at: number; presetTitle: string; result: EvalResponse; questions: Questions };

export function Playground() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [stateText, setStateText] = useState(stringifyState(PRESETS[0].state));
  const [questions, setQuestions] = useState<Questions>(PRESETS[0].questions);
  const [zdr, setZdr] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ response: EvalResponse; questions: Questions } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const state = parseState(stateText);

  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setStateText(stringifyState(p.state));
    setQuestions(p.questions);
    setResult(null);
    setError(null);
  };

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await evaluateJev({ state, questions, zeroDataRetention: zdr });
      setResult({ response, questions });
      setHistory((h) => [{ at: Date.now(), presetTitle: preset.title, result: response, questions }, ...h].slice(0, 12));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [state, questions, zdr, preset.title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !running) run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, running]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel
          title="Scenario"
          actions={
            <select className="px-2 py-1 text-xs" value={presetId} onChange={(e) => loadPreset(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          }
        >
          <p className="text-sm text-muted">{preset.blurb}</p>
        </Panel>

        <Panel
          title="State"
          actions={<Tag tone="accent">{typeof state === 'string' ? 'string' : Array.isArray(state) ? 'array' : 'object'}</Tag>}
        >
          <CodeEditor value={stateText} onChange={setStateText} lang={stateLang(state)} className="h-56" />
          <p className="mt-1 text-[11px] text-muted">Valid JSON is sent as an object or array; anything else is sent as a string. Max 32k tokens of state.</p>
        </Panel>

        <Panel title="Questions">
          <QuestionEditor questions={questions} onChange={setQuestions} />
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel
          title="Result"
          actions={
            <>
              <span className="flex items-center gap-1.5">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={zdr} onChange={(e) => setZdr(e.target.checked)} /> ZDR
                </label>
                <InfoTip label="What is ZDR?">
                  <b className="text-fg">Zero Data Retention.</b> Sets <code className="break-all font-mono text-[11px] text-fg">providerOptions.gateway.zeroDataRetention</code>, so AI
                  Gateway only routes the request to providers with a ZDR agreement: they may not store prompts or outputs, or train on them. If no
                  compliant provider serves the model, the request fails instead of falling back.
                  <span className="mt-2 block">
                    For Jev this changes nothing about routing: TypeSafe AI is the only provider and is already ZDR-compliant. Vercel itself never
                    retains request data. Per-request ZDR is free; the team-wide setting costs $0.10 per 1,000 requests.
                  </span>
                </InfoTip>
              </span>
              <Button onClick={run} disabled={running || Object.keys(questions).length === 0}>
                {running ? 'Evaluating…' : 'Evaluate'} <kbd className="text-[10px] opacity-70">⌘↵</kbd>
              </Button>
            </>
          }
        >
          {error && <ErrorBox message={error} />}
          {!result && !error && <p className="text-sm text-muted">Run the scenario to see typed answers with probabilities.</p>}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat
                  label="Latency"
                  value={`${result.response.latencyMs} ms${result.response.providerMs ? ` (${result.response.providerMs} model)` : ''}`}
                  hint="Round trip from the Next.js server; in parentheses, time spent at the model provider"
                />
                <Stat label="Input tokens" value={result.response.usage.inputTokens ?? '—'} />
                <Stat label="Cost" value={fmtUsd(result.response.costUsd)} hint="Gateway market cost" />
                <Stat label="At scale" value={fmtPerMillion(result.response.costUsd)} />
              </div>
              {Object.entries(result.response.answers).map(([id, answer]) => (
                <div key={id} className="space-y-1.5 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{id}</span>
                    <Tag>{answer.type}</Tag>
                    <span className="truncate text-xs text-muted">{result.questions[id]?.instructions}</span>
                  </div>
                  <AnswerView question={result.questions[id]} answer={answer} confidence={result.response.confidence?.[id]} />
                </div>
              ))}
              {result.response.warnings.length > 0 && (
                <Code code={JSON.stringify(result.response.warnings, null, 2)} lang="json" className="rounded-md border border-warn/40 p-2 text-xs" />
              )}
              <button className="text-xs text-muted hover:text-fg" onClick={() => setShowRaw((s) => !s)}>
                {showRaw ? 'hide' : 'show'} raw response
              </button>
              {showRaw && (
                <Code
                  code={JSON.stringify(result.response, null, 2)}
                  lang="json"
                  className="max-h-80 overflow-auto rounded-md bg-panel-2 p-3 text-[11px]"
                />
              )}
            </div>
          )}
        </Panel>

        <Panel title="Code">
          <CodeView state={state} questions={questions} />
        </Panel>

        {history.length > 1 && (
          <Panel title="Run history">
            <ul className="space-y-1 text-xs">
              {history.map((h) => (
                <li key={h.at} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-1 last:border-0">
                  <span className="text-muted">{new Date(h.at).toLocaleTimeString()}</span>
                  <span>{h.presetTitle}</span>
                  <span className="font-mono text-muted">{h.result.latencyMs} ms</span>
                  {Object.entries(h.result.answers).map(([id, a]) => (
                    <span key={id} className="font-mono">
                      {id}=
                      {a.type === 'choice' ? a.choice : a.type === 'score' ? a.score.toFixed(2) : a.probability.toFixed(2)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
