export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
};

export type ScoreQuestion = {
  type: 'score';
  instructions: string;
  criteria: (string | null)[];
};

export type BooleanQuestion = {
  type: 'boolean';
  instructions: string;
  criteria?: { true?: string | null; false?: string | null };
};

export type Question = ChoiceQuestion | ScoreQuestion | BooleanQuestion;
export type Questions = Record<string, Question>;

export type Answer =
  | { type: 'choice'; choice: string; probabilities?: Record<string, number> }
  | { type: 'score'; score: number; probabilities?: Record<string, number> }
  | { type: 'boolean'; probability: number };

export type EvalRequest = {
  state: JsonValue;
  questions: Questions;
  zeroDataRetention?: boolean;
};

export type EvalResponse = {
  answers: Record<string, Answer>;
  confidence?: Record<string, number>;
  usage: { inputTokens?: number; outputTokens?: number };
  costUsd?: number;
  latencyMs: number;
  /** Time the gateway spent waiting on the model provider. */
  providerMs?: number;
  modelId?: string;
  warnings: unknown[];
  providerMetadata?: Record<string, unknown>;
};

export type EvalError = { error: string; retryAfterS?: number; details?: unknown };

export type Preset = {
  id: string;
  title: string;
  blurb: string;
  state: JsonValue;
  questions: Questions;
};
