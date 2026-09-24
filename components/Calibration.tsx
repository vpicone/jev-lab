'use client';

import { useMemo, useState } from 'react';
import { DATASETS } from '@/lib/datasets';
import { evaluateJev, fmtPct, fmtUsd, mapLimit } from '@/lib/client';
import type { Question } from '@/lib/types';
import { Code, stateLang } from './Code';
import { QuestionEditor } from './QuestionEditor';
import { useRateLimit } from './RateLimit';
import { Button, ErrorBox, Panel, Stat, Tag } from './ui';

type Row = {
  predicted?: string;
  /** Choice: P(selected). Boolean: P(true). */
  p?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
  latencyMs?: number;
  cost?: number;
  error?: string;
};

const SWEEP = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];

function ReliabilityChart({ bins }: { bins: { label: string; predicted: number; observed: number; n: number }[] }) {
  const size = 200;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <svg viewBox={`0 0 ${size + 30} ${size + 30}`} className="w-56" role="img" aria-label="Reliability diagram">
        <g transform="translate(25,5)">
          <rect width={size} height={size} fill="var(--panel-2)" />
          <line x1={0} y1={size} x2={size} y2={0} stroke="var(--muted)" strokeDasharray="4 3" />
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <text x={-4} y={size - t * size + 3} fontSize="9" textAnchor="end" fill="var(--muted)">
                {t}
              </text>
              <text x={t * size} y={size + 12} fontSize="9" textAnchor="middle" fill="var(--muted)">
                {t}
              </text>
            </g>
          ))}
          {bins
            .filter((b) => b.n > 0)
            .map((b) => (
              <circle key={b.label} cx={b.predicted * size} cy={size - b.observed * size} r={3 + Math.sqrt(b.n) * 1.5} fill="var(--bar)" fillOpacity={0.75}>
                <title>{`${b.label}: predicted ${b.predicted.toFixed(2)}, observed ${b.observed.toFixed(2)} (n=${b.n})`}</title>
              </circle>
            ))}
        </g>
      </svg>
      <div className="text-xs text-muted">
        <p className="mb-1">x = mean predicted probability, y = observed frequency.</p>
        <p className="mb-2">Dots on the dashed line are well calibrated. Dot size = number of items.</p>
        <table className="font-mono">
          <tbody>
            {bins.map((b) => (
              <tr key={b.label}>
                <td className="pr-3">{b.label}</td>
                <td className="pr-3">n={b.n}</td>
                <td className="pr-3">pred {b.n ? b.predicted.toFixed(2) : '—'}</td>
                <td>obs {b.n ? b.observed.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function bin<T>(items: T[], edges: number[], value: (t: T) => number, hit: (t: T) => boolean) {
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const inBin = items.filter((t) => {
      const v = value(t);
      return v >= lo && (i === edges.length - 2 ? v <= hi : v < hi);
    });
    return {
      label: `${lo.toFixed(2)}–${hi.toFixed(2)}`,
      n: inBin.length,
      predicted: inBin.reduce((a, t) => a + value(t), 0) / (inBin.length || 1),
      observed: inBin.filter(hit).length / (inBin.length || 1),
    };
  });
}

export function Calibration() {
  const [datasetId, setDatasetId] = useState(DATASETS[0].id);
  const dataset = DATASETS.find((d) => d.id === datasetId)!;
  const [question, setQuestion] = useState<Question>(dataset.question);
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [gate, setGate] = useState<'probability' | 'confidence'>('probability');
  const [threshold, setThreshold] = useState(0.8);
  const [errorsOnly, setErrorsOnly] = useState(false);

  const { waitingS } = useRateLimit();
  const isChoice = question.type === 'choice';

  const switchDataset = (id: string) => {
    const d = DATASETS.find((x) => x.id === id)!;
    setDatasetId(id);
    setQuestion(d.question);
    setRows([]);
    setProgress(null);
  };

  const run = async () => {
    setRows([]);
    setProgress(0);
    let done = 0;
    const out = await mapLimit(
      dataset.items,
      4,
      async (item): Promise<Row> => {
        try {
          const r = await evaluateJev({ state: item.state, questions: { decision: question } });
          const a = r.answers.decision;
          const base = { latencyMs: r.latencyMs, cost: r.costUsd, confidence: r.confidence?.decision };
          if (a.type === 'choice') return { ...base, predicted: a.choice, p: a.probabilities?.[a.choice], probabilities: a.probabilities };
          if (a.type === 'boolean') return { ...base, predicted: String(a.probability >= 0.5), p: a.probability };
          return { ...base, error: 'Score questions are not supported in this bench.' };
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
      () => setProgress(++done),
    );
    setRows(out);
    setProgress(null);
  };

  const scored = useMemo(
    () =>
      rows
        .map((r, i) => ({ ...r, item: dataset.items[i], correct: r.predicted === dataset.items[i].label }))
        .filter((r) => r.p !== undefined),
    [rows, dataset.items],
  );

  const gateValue = (r: (typeof scored)[number]) => (gate === 'confidence' && r.confidence !== undefined ? r.confidence : (r.p ?? 0));
  /** Boolean bench: distance from 0.5 folded into [0.5, 1] so one threshold means "approve if p ≥ t, deny if p ≤ 1−t". */
  const certainty = (r: (typeof scored)[number]) => (isChoice ? gateValue(r) : Math.max(r.p ?? 0, 1 - (r.p ?? 0)));

  const sweep = SWEEP.map((t) => {
    const auto = scored.filter((r) => certainty(r) >= t);
    const errors = auto.filter((r) => !r.correct).length;
    return { t, auto: auto.length, errors, review: scored.length - auto.length };
  });

  const accuracy = scored.length ? scored.filter((r) => r.correct).length / scored.length : undefined;
  const totalCost = rows.reduce((a, r) => a + (r.cost ?? 0), 0);
  const latencies = rows.map((r) => r.latencyMs).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length / 2)];
  const hasConfidence = scored.some((r) => r.confidence !== undefined);

  const bins = isChoice
    ? bin(scored, [0, 0.5, 0.7, 0.8, 0.9, 0.95, 1], (r) => r.p ?? 0, (r) => r.correct)
    : bin(scored, [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1], (r) => r.p ?? 0, (r) => r.item.label === 'true');

  const labels = isChoice ? Object.keys(question.criteria) : ['true', 'false'];
  const errorsList = rows.filter((r) => r.error);

  return (
    <div className="space-y-4">
      <Panel
        title="Calibration bench"
        actions={
          <>
            <select className="px-2 py-1 text-xs" value={datasetId} onChange={(e) => switchDataset(e.target.value)}>
              {DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <Button onClick={run} disabled={progress !== null}>
              {progress !== null
                ? waitingS
                  ? `Rate limited, resuming in ${waitingS}s (${progress}/${dataset.items.length})`
                  : `Running ${progress}/${dataset.items.length}`
                : `Run ${dataset.items.length} items`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {dataset.blurb} Edit the question below and re-run to see how wording changes accuracy and calibration. With this few items, treat the
          numbers as directional; for real thresholds, use a held-out set you did not tune on. The free AI Gateway tier allows 30 requests a
          minute, so a full run pauses once and resumes on its own.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel title="Question under test">
          <QuestionEditor
            single
            questions={{ decision: question }}
            onChange={(q) => {
              const first = Object.values(q)[0];
              if (first) setQuestion(first);
            }}
          />
        </Panel>

        <div className="space-y-4">
          {errorsList.length > 0 && <ErrorBox message={`${errorsList.length} item(s) failed: ${errorsList[0].error}`} />}
          {scored.length > 0 && (
            <>
              <Panel title="Summary">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Stat label="Accuracy (all)" value={fmtPct(accuracy)} />
                  <Stat label="Items" value={scored.length} />
                  <Stat label="p50 latency" value={p50 ? `${p50} ms` : '—'} hint="Per call, 4 in flight" />
                  <Stat label="Total cost" value={fmtUsd(totalCost)} />
                </div>
              </Panel>

              <Panel
                title={isChoice ? 'Threshold sweep: auto-route vs review' : 'Threshold sweep: approve if p ≥ t, deny if p ≤ 1−t, else review'}
                actions={
                  isChoice && hasConfidence ? (
                    <select className="px-2 py-1 text-xs" value={gate} onChange={(e) => setGate(e.target.value as typeof gate)}>
                      <option value="probability">gate on P(selected)</option>
                      <option value="confidence">gate on confidence</option>
                    </select>
                  ) : undefined
                }
              >
                <table className="w-full text-left font-mono text-xs tabular-nums">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1">threshold</th>
                      <th>automated</th>
                      <th>errors in automated</th>
                      <th>error rate</th>
                      <th>to review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweep.map((s) => (
                      <tr key={s.t} className={`border-t border-border ${s.t === threshold ? 'bg-accent-soft' : ''}`} onClick={() => setThreshold(s.t)}>
                        <td className="py-1">≥ {s.t}</td>
                        <td>
                          {s.auto}/{scored.length} ({fmtPct(s.auto / scored.length)})
                        </td>
                        <td className={s.errors ? 'text-bad' : 'text-good'}>{s.errors}</td>
                        <td>{s.auto ? fmtPct(s.errors / s.auto) : '—'}</td>
                        <td>{s.review}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted">
                  Error rate is over automated items only; record both denominators. Click a row to highlight items below that threshold.
                </p>
              </Panel>

              <Panel title="Reliability">
                <ReliabilityChart bins={bins} />
              </Panel>

              <Panel title="Confusion matrix (rows = gold, columns = predicted)">
                <table className="font-mono text-xs tabular-nums">
                  <thead>
                    <tr>
                      <th />
                      {labels.map((l) => (
                        <th key={l} className="px-2 py-1 text-muted">
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labels.map((gold) => (
                      <tr key={gold}>
                        <th className="pr-2 text-right text-muted">{gold}</th>
                        {labels.map((pred) => {
                          const n = scored.filter((r) => r.item.label === gold && r.predicted === pred).length;
                          return (
                            <td key={pred} className={`px-3 py-1 text-center ${n ? (gold === pred ? 'bg-good/15' : 'bg-bad/15') : ''}`}>
                              {n || '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel
                title="Items"
                actions={
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} /> errors only
                  </label>
                }
              >
                <table className="w-full text-left text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1">state</th>
                      <th>gold</th>
                      <th>predicted</th>
                      <th>{isChoice ? 'P(sel)' : 'P(true)'}</th>
                      {isChoice && hasConfidence && <th>conf</th>}
                      <th>route</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scored
                      .filter((r) => !errorsOnly || !r.correct)
                      .map((r, i) => {
                        const automated = certainty(r) >= threshold;
                        return (
                          <tr key={i} className="border-t border-border align-top">
                            <td className="max-w-md py-1.5 pr-2">
                              <Code
                                code={typeof r.item.state === 'string' ? r.item.state : JSON.stringify(r.item.state)}
                                lang={stateLang(r.item.state)}
                                className="line-clamp-2 whitespace-pre-wrap break-words text-[11px]"
                              />
                              {r.item.note && <div className="text-[11px] text-warn">{r.item.note}</div>}
                            </td>
                            <td className="font-mono">{r.item.label}</td>
                            <td className={`font-mono ${r.correct ? 'text-good' : 'text-bad'}`}>{r.predicted}</td>
                            <td className="font-mono tabular-nums">{r.p?.toFixed(2)}</td>
                            {isChoice && hasConfidence && <td className="font-mono tabular-nums">{r.confidence?.toFixed(2) ?? '—'}</td>}
                            <td>
                              <Tag tone={automated ? (r.correct ? 'good' : 'bad') : 'neutral'}>{automated ? 'auto' : 'review'}</Tag>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
