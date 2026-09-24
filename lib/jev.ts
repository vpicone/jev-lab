import { experimental_evaluate as evaluate } from 'ai';
import type { EvalRequest, EvalResponse } from './types';

export const JEV_MODEL = 'typesafe-ai/jev';
export const JEV_INPUT_USD_PER_TOKEN = 0.042 / 1_000_000;

export async function runJev({
  state,
  questions,
  zeroDataRetention,
}: EvalRequest): Promise<EvalResponse> {
  const started = performance.now();
  const result = await evaluate({
    model: JEV_MODEL,
    state: typeof state === 'object' && state !== null ? state : String(state ?? ''),
    questions,
    maxRetries: 0,
    providerOptions: zeroDataRetention
      ? { gateway: { zeroDataRetention: true } }
      : undefined,
  });
  const latencyMs = Math.round(performance.now() - started);

  const metadata = result.providerMetadata as
    | Record<string, Record<string, unknown>>
    | undefined;
  const gatewayCost = Number(metadata?.gateway?.marketCost ?? metadata?.gateway?.cost);
  const inputTokens = result.usage.inputTokens;

  return {
    answers: result.answers,
    confidence: metadata?.typesafe?.confidence as
      | Record<string, number>
      | undefined,
    usage: { inputTokens, outputTokens: result.usage.outputTokens },
    costUsd: Number.isFinite(gatewayCost)
      ? gatewayCost
      : inputTokens !== undefined
        ? inputTokens * JEV_INPUT_USD_PER_TOKEN
        : undefined,
    latencyMs,
    providerMs: providerTime(metadata),
    modelId: result.response.modelId,
    warnings: result.warnings,
    providerMetadata: metadata,
  };
}

type Attempts = { modelAttempts?: { providerAttempts?: { startTime?: number; endTime?: number }[] }[] };

export function providerTime(metadata?: Record<string, Record<string, unknown>>) {
  const attempts = (metadata?.gateway?.routing as Attempts | undefined)?.modelAttempts?.flatMap((m) => m.providerAttempts ?? []) ?? [];
  const last = attempts.at(-1);
  return last?.startTime && last.endTime ? last.endTime - last.startTime : undefined;
}
