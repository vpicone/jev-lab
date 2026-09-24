'use client';

import type { Question, Questions } from '@/lib/types';
import { Button } from './ui';

function convert(q: Question, type: Question['type']): Question {
  if (q.type === type) return q;
  const labels = q.type === 'choice' ? Object.keys(q.criteria) : q.type === 'score' ? q.criteria.map((c, i) => c ?? `level_${i}`) : ['no', 'yes'];
  if (type === 'boolean') return { type, instructions: q.instructions };
  if (type === 'score')
    return {
      type,
      instructions: q.instructions,
      criteria: labels.length >= 2 ? labels : ['low', 'high'],
    };
  return {
    type,
    instructions: q.instructions,
    criteria: Object.fromEntries(
      labels.map((l, i) => [
        String(l)
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_')
          .slice(0, 32) || `option_${i}`,
        null,
      ]),
    ),
  };
}

function CriteriaEditor({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  if (q.type === 'choice') {
    const entries = Object.entries(q.criteria);
    const set = (next: [string, string | null][]) => onChange({ ...q, criteria: Object.fromEntries(next) });
    return (
      <div className="space-y-1.5">
        {entries.map(([key, desc], i) => (
          <div key={i} className="flex gap-1.5">
            <input
              className="w-36 shrink-0 px-2 py-1 font-mono text-xs"
              value={key}
              onChange={(e) => set(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)))}
            />
            <input
              className="min-w-0 flex-1 px-2 py-1 text-xs"
              placeholder="description (optional)"
              value={desc ?? ''}
              onChange={(e) => set(entries.map((en, j) => (j === i ? [en[0], e.target.value || null] : en)))}
            />
            <button
              className="px-1 text-xs text-muted hover:text-bad"
              onClick={() => set(entries.filter((_, j) => j !== i))}
              aria-label="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="text-xs text-accent" onClick={() => set([...entries, [`option_${entries.length + 1}`, null]])}>
          + option
        </button>
      </div>
    );
  }
  if (q.type === 'score') {
    const set = (criteria: (string | null)[]) => onChange({ ...q, criteria });
    return (
      <div className="space-y-1.5">
        {q.criteria.map((level, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-5 text-right font-mono text-xs text-muted">{i}</span>
            <input
              className="min-w-0 flex-1 px-2 py-1 text-xs"
              value={level ?? ''}
              onChange={(e) => set(q.criteria.map((c, j) => (j === i ? e.target.value : c)))}
            />
            <button
              className="px-1 text-xs text-muted hover:text-bad disabled:opacity-30"
              disabled={q.criteria.length <= 2}
              onClick={() => set(q.criteria.filter((_, j) => j !== i))}
              aria-label="Remove level"
            >
              ✕
            </button>
          </div>
        ))}
        {q.criteria.length < 10 && (
          <button className="text-xs text-accent" onClick={() => set([...q.criteria, ''])}>
            + level (lowest → highest)
          </button>
        )}
      </div>
    );
  }
  const c = q.criteria ?? {};
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {(['true', 'false'] as const).map((side) => (
        <input
          key={side}
          className="px-2 py-1 text-xs"
          placeholder={`${side}: what this case means (optional)`}
          value={c[side] ?? ''}
          onChange={(e) => {
            const next = { ...c, [side]: e.target.value || undefined };
            onChange({
              ...q,
              criteria: next.true || next.false ? next : undefined,
            });
          }}
        />
      ))}
    </div>
  );
}

export function QuestionEditor({
  questions,
  onChange,
  single = false,
}: {
  questions: Questions;
  onChange: (q: Questions) => void;
  single?: boolean;
}) {
  const entries = Object.entries(questions);
  const update = (i: number, id: string, q: Question) => onChange(Object.fromEntries(entries.map((en, j) => (j === i ? [id, q] : en))));

  return (
    <div className="space-y-3">
      {entries.map(([id, q], i) => (
        <div key={i} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center gap-2">
            <input className="w-40 px-2 py-1 font-mono text-xs" value={id} onChange={(e) => update(i, e.target.value, q)} aria-label="Question id" />
            <select className="px-2 py-1 text-xs" value={q.type} onChange={(e) => update(i, id, convert(q, e.target.value as Question['type']))}>
              <option value="choice">choice</option>
              <option value="score">score</option>
              <option value="boolean">boolean</option>
            </select>
            {!single && (
              <button
                className="ml-auto text-xs text-muted hover:text-bad"
                onClick={() => onChange(Object.fromEntries(entries.filter((_, j) => j !== i)))}
              >
                remove
              </button>
            )}
          </div>
          <input
            className="w-full px-2 py-1.5 text-sm"
            placeholder="instructions: the question to answer"
            value={q.instructions}
            onChange={(e) => update(i, id, { ...q, instructions: e.target.value })}
          />
          <CriteriaEditor q={q} onChange={(nq) => update(i, id, nq)} />
        </div>
      ))}
      {!single && (
        <Button
          variant="ghost"
          onClick={() =>
            onChange({
              ...questions,
              [`q${entries.length + 1}`]: { type: 'boolean', instructions: '' },
            })
          }
        >
          + question
        </Button>
      )}
    </div>
  );
}
