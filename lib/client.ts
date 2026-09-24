import type { EvalError, EvalRequest, EvalResponse, JsonValue, Questions } from './types';

export type RateState = { waitingUntil?: number };

let rateState: RateState = {};
const listeners = new Set<() => void>();

export const rateStore = {
  get: () => rateState,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function setRate(next: Partial<RateState>) {
  rateState = { ...rateState, ...next };
  listeners.forEach((l) => l());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The free tier's 30 requests/minute is a rolling window, so after the first 429 requests are spaced out instead of resumed as a burst. */
const PACED_INTERVAL_MS = 2100;
let paced = false;
let nextSlot = 0;

async function waitForSlot() {
  const wait = (rateState.waitingUntil ?? 0) - Date.now();
  if (wait > 0) await sleep(wait);
  if (!paced) return;
  const slot = Math.max(Date.now(), nextSlot);
  nextSlot = slot + PACED_INTERVAL_MS;
  await sleep(slot - Date.now());
}

async function post<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await waitForSlot();

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();

    if (res.ok) return data as T;
    if (res.status === 429 && attempt < 8) {
      paced = true;
      const retryAfterS = (data as EvalError).retryAfterS ?? 15;
      const until = Date.now() + retryAfterS * 1000;
      setRate({ waitingUntil: Math.max(until, rateState.waitingUntil ?? 0) });
      continue;
    }
    if (res.status === 503 && attempt < 6) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    throw new Error((data as EvalError).error ?? `HTTP ${res.status}`);
  }
}

export const evaluateJev = (body: EvalRequest) => post<EvalResponse>('/api/evaluate', body);

export const evaluateLlm = (body: { model: string; state: JsonValue; questions: Questions }) =>
  post<EvalResponse>('/api/compare', body);

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onEach?: (result: R, index: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      onEach?.(results[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function parseState(text: string): JsonValue {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }
  return text;
}

export function stringifyState(state: JsonValue): string {
  return typeof state === 'string' ? state : JSON.stringify(state, null, 2);
}

export const fmtUsd = (n?: number) =>
  n === undefined ? '—' : n < 0.01 ? `$${Number(n.toPrecision(3))}` : `$${n.toFixed(4)}`;

export const fmtPerMillion = (n?: number) =>
  n === undefined ? '—' : `$${(n * 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} / 1M calls`;

export const fmtPct = (p?: number) => (p === undefined ? '—' : `${Math.round(p * 100)}%`);
