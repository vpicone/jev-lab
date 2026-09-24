import type { JsonValue, Questions } from './types';

export type Variant = { label: string; state?: JsonValue; questions: Questions };

export type Lesson = {
  id: string;
  title: string;
  hypothesis: string;
  lookFor: string;
  /** Question id whose answer is compared across variants. */
  focus: string;
  state: JsonValue;
  variants: Variant[];
};

const ambiguousTicket =
  'The dashboard has been really slow since this morning, some charts take 20+ seconds to load. We have a board meeting tomorrow and need the numbers.';

const severityVerbose = [
  'Cosmetic or informational: no impact on getting work done',
  'Degraded: slower or clunkier, but the user can still get the work done',
  'Blocking: the user cannot complete the task and has no workaround',
  'Critical: blocking and causing financial loss, data loss, or a missed commitment',
];

const routeCriteria = {
  billing: 'Charges, invoices, and refunds',
  technical: 'Bugs, outages, and integration failures',
  account: 'Login, permissions, and profile changes',
  sales: 'Pricing questions, upgrades, and new contracts',
};

function reorder<T extends Record<string, unknown>>(obj: T, order: (keyof T)[]): T {
  return Object.fromEntries(order.map((k) => [k, obj[k]])) as T;
}

export const LESSONS: Lesson[] = [
  {
    id: 'criteria-wording',
    title: 'Terse vs descriptive criteria',
    hypothesis: 'Criteria text is the model’s only definition of each option. Descriptive rungs should sharpen the distribution.',
    lookFor: 'Compare how concentrated each distribution is and whether the chosen level moves.',
    focus: 'severity',
    state: ambiguousTicket,
    variants: [
      { label: 'Bare labels', questions: { severity: { type: 'score', instructions: 'How severe is this?', criteria: ['low', 'medium', 'high', 'critical'] } } },
      { label: 'Short phrases', questions: { severity: { type: 'score', instructions: 'How severe is this?', criteria: ['Cosmetic', 'Degraded', 'Blocking', 'Blocking with loss'] } } },
      { label: 'Full rubric', questions: { severity: { type: 'score', instructions: 'How severe is this?', criteria: severityVerbose } } },
    ],
  },
  {
    id: 'option-order',
    title: 'Does option order matter?',
    hypothesis: 'A well-behaved classifier should give the same distribution no matter how the options are listed.',
    lookFor: 'If probabilities shift noticeably between orderings, the decision is fragile; treat it as ambiguous.',
    focus: 'route',
    state: 'Hi, I was charged for 12 seats but we only have 9 people. Also, can I get a quote for the Enterprise plan?',
    variants: [
      { label: 'Original', questions: { route: { type: 'choice', instructions: 'Route this ticket.', criteria: routeCriteria } } },
      { label: 'Reversed', questions: { route: { type: 'choice', instructions: 'Route this ticket.', criteria: reorder(routeCriteria, ['sales', 'account', 'technical', 'billing']) } } },
      { label: 'Shuffled', questions: { route: { type: 'choice', instructions: 'Route this ticket.', criteria: reorder(routeCriteria, ['technical', 'sales', 'billing', 'account']) } } },
    ],
  },
  {
    id: 'abstain',
    title: 'Adding an insufficient-evidence option',
    hypothesis: 'Without an abstain option the model must spread mass across real options. With one, thin evidence can go there explicitly.',
    lookFor: 'Where the probability mass goes when evidence is thin, and whether the top pick is still confident without the escape hatch.',
    focus: 'owner',
    state: { observations: [{ at: '09:14Z', source: 'pager', text: 'Checkout conversion dropped 40% in the last 15 minutes.' }] },
    variants: [
      {
        label: 'No abstain',
        questions: { owner: { type: 'choice', instructions: 'Which team owns the root cause?', criteria: { payments: 'Payment backend or provider', storefront: 'Frontend web code or deploys', infrastructure: 'CDN, DNS, networking, hosting' } } },
      },
      {
        label: 'With abstain',
        questions: {
          owner: {
            type: 'choice',
            instructions: 'Which team owns the root cause?',
            criteria: { payments: 'Payment backend or provider', storefront: 'Frontend web code or deploys', infrastructure: 'CDN, DNS, networking, hosting', insufficient_evidence: 'The observations do not distinguish between the teams.' },
          },
        },
      },
    ],
  },
  {
    id: 'negation',
    title: 'Boolean consistency under negation',
    hypothesis: 'P(X) and P(not X) should sum to ~1. A large gap means the question wording is doing the work, not the evidence.',
    lookFor: 'Add the two probabilities. Near 1.0 means the model is consistent under negation.',
    focus: 'q',
    state: 'Customer: "The invoice total looks right, but the tax line seems off? Not sure, maybe I am reading it wrong."',
    variants: [
      { label: 'Positive', questions: { q: { type: 'boolean', instructions: 'Is the customer reporting an error on the invoice?' } } },
      { label: 'Negated', questions: { q: { type: 'boolean', instructions: 'Is the customer saying the invoice has no errors?' } } },
    ],
  },
  {
    id: 'paraphrase',
    title: 'Instruction paraphrase stability',
    hypothesis: 'If equivalent wordings give different answers, the question is underspecified.',
    lookFor: 'Spread of P(true) across paraphrases. Treat the range as a floor on your uncertainty.',
    focus: 'q',
    state: 'User: "Can you send me the file? Actually never mind, I found it in my downloads."',
    variants: [
      { label: 'Direct', questions: { q: { type: 'boolean', instructions: 'Does the user still need help?' } } },
      { label: 'Formal', questions: { q: { type: 'boolean', instructions: 'Is there an outstanding request from the user that requires action?' } } },
      { label: 'Casual', questions: { q: { type: 'boolean', instructions: 'Should someone follow up with this user?' } } },
    ],
  },
  {
    id: 'isolation',
    title: 'One question vs many in a request',
    hypothesis: 'Jev evaluates questions independently, so bundling should not change an answer and saves round trips.',
    lookFor: 'The focus answer should match across variants. Compare latency and tokens: one bundled call vs several single calls.',
    focus: 'refund',
    state: 'I cannot log in since the password reset, and honestly I want my money back for this month.',
    variants: [
      { label: 'Alone', questions: { refund: { type: 'boolean', instructions: 'Is the customer asking for money back?' } } },
      {
        label: 'Bundled with 5 others',
        questions: {
          refund: { type: 'boolean', instructions: 'Is the customer asking for money back?' },
          auth: { type: 'boolean', instructions: 'Is there a login problem?' },
          angry: { type: 'score', instructions: 'How upset is the customer?', criteria: ['Calm', 'Annoyed', 'Angry'] },
          team: { type: 'choice', instructions: 'Route this ticket.', criteria: routeCriteria },
          churn: { type: 'boolean', instructions: 'Is the customer likely to cancel?' },
          bug: { type: 'boolean', instructions: 'Does this describe a software bug?' },
        },
      },
    ],
  },
  {
    id: 'state-shape',
    title: 'Prose vs structured vs noisy state',
    hypothesis: 'Focused state should be cheaper and at least as accurate. Irrelevant fields add tokens and can distract.',
    lookFor: 'Compare input tokens and the answer across the three shapes.',
    focus: 'eligible',
    state: '',
    variants: [
      {
        label: 'Prose',
        state: 'Order A-1042 was delivered 12 days ago. The customer opened and used the product. Policy: returns within 30 days, unused items only.',
        questions: { eligible: { type: 'boolean', instructions: 'Is this order eligible for a return under the policy?' } },
      },
      {
        label: 'Structured',
        state: { order: 'A-1042', daysSinceDelivery: 12, itemUsed: true, policy: { windowDays: 30, unusedOnly: true } },
        questions: { eligible: { type: 'boolean', instructions: 'Is this order eligible for a return under the policy?' } },
      },
      {
        label: 'Structured + noise',
        state: {
          order: 'A-1042',
          daysSinceDelivery: 12,
          itemUsed: true,
          policy: { windowDays: 30, unusedOnly: true },
          customer: { name: 'Dana', tier: 'gold', lifetimeValue: 4210, marketingOptIn: true, notes: 'VIP, always accommodate' },
          warehouse: { id: 'SFO-3', shift: 'B', pickerId: 88213 },
          shipping: { carrier: 'UPS', service: 'Ground', weightKg: 1.2 },
        },
        questions: { eligible: { type: 'boolean', instructions: 'Is this order eligible for a return under the policy?' } },
      },
    ],
  },
  {
    id: 'granularity',
    title: 'Score rubric granularity',
    hypothesis: 'More levels give finer scores but spread probability thinner. Pick the coarsest scale your code branches on.',
    lookFor: 'Normalize each score to 0–1 (shown) and compare how peaked each distribution is.',
    focus: 'quality',
    state: 'PR: "Fix typo in README". Diff changes "recieve" to "receive" in one line. No tests, no linked issue, description is the title.',
    variants: [
      { label: '2 levels', questions: { quality: { type: 'score', instructions: 'Rate this pull request.', criteria: ['Needs changes', 'Ready to merge'] } } },
      { label: '4 levels', questions: { quality: { type: 'score', instructions: 'Rate this pull request.', criteria: ['Reject', 'Needs major changes', 'Needs minor changes', 'Ready to merge'] } } },
      {
        label: '7 levels',
        questions: {
          quality: {
            type: 'score',
            instructions: 'Rate this pull request.',
            criteria: ['Harmful', 'Reject', 'Major rework', 'Several changes', 'Minor nits', 'Good', 'Exemplary'],
          },
        },
      },
    ],
  },
];
