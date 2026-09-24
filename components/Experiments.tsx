'use client';

import { useState } from 'react';
import { LESSONS, type Lesson } from '@/lib/lessons';
import { evaluateJev, fmtUsd, stringifyState } from '@/lib/client';
import type { EvalResponse } from '@/lib/types';
import { AnswerView } from './AnswerView';
import { Code, stateLang } from './Code';
import { Button, ErrorBox, Panel, Stat } from './ui';

type Outcome = { response?: EvalResponse; error?: string };

function Summary({ lesson, outcomes }: { lesson: Lesson; outcomes: Outcome[] }) {
  const answers = outcomes.map((o) => o.response?.answers[lesson.focus]);
  if (answers.some((a) => !a)) return null;

  if (lesson.id === 'negation' && answers[0]?.type === 'boolean' && answers[1]?.type === 'boolean') {
    const sum = answers[0].probability + answers[1].probability;
    return (
      <p className="text-sm">
        P(positive) + P(negated) = <span className="font-mono font-semibold">{sum.toFixed(2)}</span>{' '}
        <span className="text-muted">{Math.abs(sum - 1) < 0.15 ? '— consistent under negation.' : '— the wording is moving the answer.'}</span>
      </p>
    );
  }

  if (answers.every((a) => a?.type === 'boolean')) {
    const ps = answers.map((a) => (a as { probability: number }).probability);
    return (
      <p className="text-sm">
        P(true) range across variants: <span className="font-mono font-semibold">{(Math.max(...ps) - Math.min(...ps)).toFixed(2)}</span>
      </p>
    );
  }

  if (answers.every((a) => a?.type === 'choice')) {
    const picks = answers.map((a) => (a as { choice: string }).choice);
    const keys = Object.keys((answers[0] as { probabilities?: Record<string, number> }).probabilities ?? {});
    const maxShift = Math.max(
      0,
      ...keys.map((k) => {
        const vals = answers.map((a) => (a as { probabilities?: Record<string, number> }).probabilities?.[k] ?? 0);
        return Math.max(...vals) - Math.min(...vals);
      }),
    );
    return (
      <p className="text-sm">
        Picks: <span className="font-mono">{picks.join(' / ')}</span> · largest per-option shift:{' '}
        <span className="font-mono font-semibold">{maxShift.toFixed(2)}</span>
      </p>
    );
  }

  if (answers.every((a) => a?.type === 'score')) {
    const norms = answers.map((a, i) => {
      const levels = lesson.variants[i].questions[lesson.focus];
      const max = levels.type === 'score' ? levels.criteria.length - 1 : 1;
      return (a as { score: number }).score / max;
    });
    return (
      <p className="text-sm">
        Normalized scores: <span className="font-mono">{norms.map((n) => n.toFixed(2)).join(' / ')}</span>
      </p>
    );
  }
  return null;
}

export function Experiments() {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome[]>>({});
  const [running, setRunning] = useState(false);
  const lesson = LESSONS.find((l) => l.id === lessonId)!;
  const current = outcomes[lessonId];

  const run = async () => {
    setRunning(true);
    const results = await Promise.all(
      lesson.variants.map((v) =>
        evaluateJev({ state: v.state ?? lesson.state, questions: v.questions })
          .then((response) => ({ response }))
          .catch((e: Error) => ({ error: e.message })),
      ),
    );
    setOutcomes((o) => ({ ...o, [lessonId]: results }));
    setRunning(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav className="space-y-1">
        {LESSONS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setLessonId(l.id)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm ${l.id === lessonId ? 'bg-accent-soft text-accent' : 'hover:bg-panel-2'}`}
          >
            <span className="mr-2 font-mono text-xs text-muted">{i + 1}</span>
            {l.title}
            {outcomes[l.id] && <span className="ml-1 text-good">•</span>}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        <Panel title={lesson.title} actions={<Button onClick={run} disabled={running}>{running ? 'Running…' : `Run ${lesson.variants.length} variants`}</Button>}>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Hypothesis.</span> {lesson.hypothesis}
            </p>
            <p className="text-muted">
              <span className="font-medium text-fg">Look for.</span> {lesson.lookFor}
            </p>
            {lesson.state !== '' && (
              <Code
                code={stringifyState(lesson.state)}
                lang={stateLang(lesson.state)}
                className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-panel-2 p-2 text-xs"
              />
            )}
            {current && (
              <div className="rounded-md border border-accent/30 bg-accent-soft/50 p-3">
                <Summary lesson={lesson} outcomes={current} />
              </div>
            )}
          </div>
        </Panel>

        <div className={`grid gap-4 ${lesson.variants.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {lesson.variants.map((v, i) => {
            const q = v.questions[lesson.focus];
            const out = current?.[i];
            return (
              <Panel key={v.label} title={v.label}>
                <div className="space-y-3">
                  {v.state !== undefined && (
                    <Code
                      code={stringifyState(v.state)}
                      lang={stateLang(v.state)}
                      className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-panel-2 p-2 text-[11px]"
                    />
                  )}
                  <div className="text-xs text-muted">
                    <div className="font-medium text-fg">{q.instructions}</div>
                    {q.type === 'choice' && <div className="font-mono">[{Object.keys(q.criteria).join(', ')}]</div>}
                    {q.type === 'score' && <div className="font-mono">{q.criteria.length} levels</div>}
                    {Object.keys(v.questions).length > 1 && <div>+ {Object.keys(v.questions).length - 1} other questions</div>}
                  </div>
                  {out?.error && <ErrorBox message={out.error} />}
                  {out?.response && (
                    <>
                      <AnswerView question={q} answer={out.response.answers[lesson.focus]} confidence={out.response.confidence?.[lesson.focus]} />
                      <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
                        <Stat label="Latency" value={`${out.response.latencyMs} ms`} />
                        <Stat label="Tokens" value={out.response.usage.inputTokens ?? '—'} />
                        <Stat label="Cost" value={fmtUsd(out.response.costUsd)} />
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
