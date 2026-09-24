import type { Answer, Question } from '@/lib/types';
import { fmtPct } from '@/lib/client';
import { Tag } from './ui';

function Bar({ label, p, highlight, detail }: { label: string; p: number; highlight: boolean; detail?: string | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-xs" title={detail ?? undefined}>
      <span className={`truncate font-mono ${highlight ? 'font-semibold text-fg' : 'text-muted'}`}>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-sm bg-panel-2">
        <div
          className={`h-full rounded-sm ${highlight ? 'bg-bar' : 'bg-bar-dim'}`}
          style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%` }}
        />
      </div>
      <span className="text-right font-mono tabular-nums text-muted">{fmtPct(p)}</span>
    </div>
  );
}

export function booleanTone(p: number) {
  return p >= 0.8 ? 'good' : p <= 0.2 ? 'bad' : 'warn';
}

export function AnswerView({ question, answer, confidence }: { question?: Question; answer: Answer; confidence?: number }) {
  if (answer.type === 'boolean') {
    const p = answer.probability;
    return (
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl tabular-nums">{p.toFixed(2)}</span>
          <span className="text-xs text-muted">P(true)</span>
          <Tag tone={booleanTone(p)}>{p >= 0.8 ? 'likely true' : p <= 0.2 ? 'likely false' : 'uncertain'}</Tag>
        </div>
        <div className="relative h-2.5 rounded-sm bg-gradient-to-r from-bad/40 via-warn/40 to-good/40">
          <div className="absolute top-[-3px] h-4 w-0.5 bg-fg" style={{ left: `calc(${p * 100}% - 1px)` }} />
        </div>
        {question?.type === 'boolean' && question.criteria && (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted">
            <span>false: {question.criteria.false}</span>
            <span className="text-right">true: {question.criteria.true}</span>
          </div>
        )}
      </div>
    );
  }

  const probs = answer.probabilities ?? {};
  if (answer.type === 'choice') {
    const criteria = question?.type === 'choice' ? question.criteria : {};
    const keys = Object.keys(criteria).length ? Object.keys(criteria) : Object.keys(probs);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-lg font-semibold">{answer.choice}</span>
          <span className="text-xs text-muted">p={fmtPct(probs[answer.choice])}</span>
          {confidence !== undefined && <span className="text-xs text-muted">confidence={confidence.toFixed(2)}</span>}
        </div>
        <div className="space-y-1">
          {keys.map((k) => (
            <Bar key={k} label={k} p={probs[k] ?? 0} highlight={k === answer.choice} detail={criteria[k]} />
          ))}
        </div>
      </div>
    );
  }

  const levels = question?.type === 'score' ? question.criteria : Object.keys(probs).map(() => null);
  const max = Math.max(1, levels.length - 1);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-2xl tabular-nums">{answer.score.toFixed(2)}</span>
        <span className="text-xs text-muted">of {max} · normalized {(answer.score / max).toFixed(2)}</span>
        {confidence !== undefined && <span className="text-xs text-muted">confidence={confidence.toFixed(2)}</span>}
      </div>
      <div className="space-y-1">
        {levels.map((label, i) => (
          <Bar
            key={i}
            label={`${i} ${label ?? ''}`}
            p={probs[String(i)] ?? 0}
            highlight={Math.round(answer.score) === i}
            detail={label}
          />
        ))}
      </div>
    </div>
  );
}
