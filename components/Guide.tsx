import { Code } from './Code';
import { Panel } from './ui';

const GUIDE_SNIPPET = `import { experimental_evaluate as evaluate } from 'ai'; // AI SDK ≥ 7

const { answers, providerMetadata } = await evaluate({
  model: 'typesafe-ai/jev',            // routed through Vercel AI Gateway
  state: { subject, message, plan },
  questions: {
    team:   { type: 'choice',  instructions: 'Which team?', criteria: { billing: '…', technical: '…' } },
    impact: { type: 'score',   instructions: 'How severe?', criteria: ['Cosmetic', 'Degraded', 'Blocking'] },
    refund: { type: 'boolean', instructions: 'Is the customer asking for money back?' },
  },
});
// answers.team.probabilities, providerMetadata?.typesafe?.confidence`;

const TYPES = [
  ['choice', 'Pick one option from a named set (up to 255).', '{ choice, probabilities }', 'Routing, intent, triage'],
  ['score', 'Grade against an ordered rubric, lowest first (2–10 levels).', '{ score, probabilities }', 'Severity, quality, relevance'],
  ['boolean', 'Estimate P(statement is true). Optional true/false criteria.', '{ probability }', 'Verification, gating, policy checks'],
];

const PRACTICES = [
  ['Ask atomic questions', 'Split a compound decision into several questions and combine the answers in code. Questions in one request are evaluated independently against the same state.'],
  ['Write descriptive criteria', 'Criteria are the only definition of each option. "Blocking with no workaround" beats "high". See Experiments → Terse vs descriptive.'],
  ['Offer an abstain option', 'Add insufficient_evidence (or similar) when thin evidence is a real outcome, so it does not get forced into a real class.'],
  ['Keep state focused', 'Pass only the fields the decision depends on. You pay per input token, and noise can distract. Evidence goes in state; the question goes in instructions.'],
  ['Threshold per action', 'Read-only actions can run at ~0.7; destructive ones need 0.9+. Send the middle band to a human. Calibrate on labeled data (Calibration tab).'],
  ['Classification ≠ authorization', 'Jev says what happened ("customer asked for a refund"). Your code decides what is allowed ("is the customer eligible?").'],
];

const PITFALLS = [
  'A score is a position on your rubric, not a probability. Do not threshold it like one.',
  'Confidence measures how concentrated a distribution is, not whether the answer is right.',
  'Boolean p ≈ 0.5 means maximal uncertainty, not "slightly yes".',
  'Probabilities are rounded to 2 decimals, so distributions can sum to 0.99. Read them with ?. and never fill gaps with 0 or 1.',
  'Do not tune thresholds on the same examples you used to refine the questions.',
  'Type safety guarantees the shape of the answer, not that it is correct.',
];

export function Guide() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="What Jev is" className="lg:col-span-2">
        <div className="space-y-2 text-sm">
          <p>
            Jev is TypeSafe AI’s “System One” model. It does not generate text. You give it a <b>state</b> (string, object or array; up to 32k
            tokens) and a map of typed <b>questions</b>, and it returns one typed answer per question, with a probability distribution.
          </p>
          <p className="text-muted">
            It is billed on input tokens only ($0.042 per 1M), and several questions share one round trip. Use it next to an LLM, not instead of
            one: routing, reranking, citation checks, judging tool calls, verifying outputs. It cannot write prose or code, and it cannot read images
            or audio directly.
          </p>
          <Code code={GUIDE_SNIPPET} lang="ts" className="overflow-auto rounded-md bg-panel-2 p-3 text-[11px] leading-relaxed" />
        </div>
      </Panel>

      <Panel title="Question types" className="lg:col-span-2">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1">type</th>
              <th>does</th>
              <th>returns</th>
              <th>good for</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map(([t, d, r, g]) => (
              <tr key={t} className="border-t border-border">
                <td className="py-1.5 font-mono">{t}</td>
                <td>{d}</td>
                <td className="font-mono text-xs">{r}</td>
                <td className="text-muted">{g}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Using it well">
        <dl className="space-y-2.5 text-sm">
          {PRACTICES.map(([t, d]) => (
            <div key={t}>
              <dt className="font-medium">{t}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="space-y-4">
        <Panel title="Pitfalls">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">
            {PITFALLS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="How to use this lab">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted">
            <li>
              <b className="text-fg">Playground</b>: seven scenarios. Edit state and questions, run, copy the generated AI SDK or curl code.
            </li>
            <li>
              <b className="text-fg">Experiments</b>: side-by-side A/B runs on wording, option order, abstain options, negation, bundling, state shape
              and rubric size.
            </li>
            <li>
              <b className="text-fg">Calibration</b>: run a labeled dataset, then read accuracy, a reliability diagram, and a threshold sweep of
              automation vs review.
            </li>
            <li>
              <b className="text-fg">Jev vs LLM</b>: the same decision through an LLM with structured output. Compare latency, cost and run-to-run
              stability.
            </li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
