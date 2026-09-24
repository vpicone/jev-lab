import { generateText, Output } from 'ai';
import { z } from 'zod';
import { errorResponse } from '@/lib/errors';
import { providerTime } from '@/lib/jev';
import type { Answer, JsonValue, Question, Questions } from '@/lib/types';

type CompareRequest = { model: string; state: JsonValue; questions: Questions };

function answerSchema(question: Question) {
  switch (question.type) {
    case 'choice': {
      const keys = Object.keys(question.criteria) as [string, ...string[]];
      return z.object({
        choice: z.enum(keys),
        probabilities: z
          .object(Object.fromEntries(keys.map((k) => [k, z.number()])))
          .describe('Your probability for each option; must sum to 1.'),
      });
    }
    case 'score':
      return z.object({
        level: z.number().int().describe(`Zero-based rubric level, 0 to ${question.criteria.length - 1}.`),
        probabilities: z
          .array(z.number())
          .describe(`Probability of each of the ${question.criteria.length} levels, in order; must sum to 1.`),
      });
    case 'boolean':
      return z.object({ probability: z.number().describe('P(statement is true), from 0 to 1.') });
  }
}

function describeQuestion(id: string, q: Question) {
  const criteria =
    q.type === 'choice'
      ? Object.entries(q.criteria).map(([k, v]) => `  - ${k}: ${v ?? ''}`).join('\n')
      : q.type === 'score'
        ? q.criteria.map((v, i) => `  ${i}. ${v ?? ''}`).join('\n')
        : q.criteria
          ? `  true: ${q.criteria.true ?? ''}\n  false: ${q.criteria.false ?? ''}`
          : '';
  return `### ${id} (${q.type})\n${q.instructions}\n${criteria}`;
}

function toAnswer(q: Question, raw: Record<string, unknown>): Answer {
  if (q.type === 'choice') {
    return { type: 'choice', choice: raw.choice as string, probabilities: raw.probabilities as Record<string, number> };
  }
  if (q.type === 'score') {
    const probs = (raw.probabilities as number[] | undefined) ?? [];
    const total = probs.reduce((a, b) => a + b, 0) || 1;
    const score = probs.length ? probs.reduce((acc, p, i) => acc + (p / total) * i, 0) : (raw.level as number);
    return {
      type: 'score',
      score,
      probabilities: Object.fromEntries(probs.map((p, i) => [String(i), p / total])),
    };
  }
  return { type: 'boolean', probability: raw.probability as number };
}

export async function POST(request: Request) {
  const { model, state, questions } = (await request.json()) as CompareRequest;
  const schema = z.object(
    Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, answerSchema(q)])),
  );

  const started = performance.now();
  try {
    const result = await generateText({
      model,
      maxRetries: 0,
      output: Output.object({ schema }),
      system:
        'You are a classifier. Evaluate the STATE against each question independently and answer with calibrated probabilities. Answer only from the evidence in the state.',
      prompt: `STATE:\n${typeof state === 'string' ? state : JSON.stringify(state, null, 2)}\n\nQUESTIONS:\n${Object.entries(questions)
        .map(([id, q]) => describeQuestion(id, q))
        .join('\n\n')}`,
    });
    const latencyMs = Math.round(performance.now() - started);
    const raw = result.output as Record<string, Record<string, unknown>>;
    const metadata = result.providerMetadata as Record<string, Record<string, unknown>> | undefined;
    const cost = Number(metadata?.gateway?.marketCost ?? metadata?.gateway?.cost);

    return Response.json({
      answers: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, toAnswer(q, raw[id])])),
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
      costUsd: Number.isFinite(cost) ? cost : undefined,
      latencyMs,
      providerMs: providerTime(metadata),
      modelId: result.response.modelId,
      warnings: result.warnings ?? [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
