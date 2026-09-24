import type { Preset } from './types';

export const PRESETS: Preset[] = [
  {
    id: 'triage',
    title: 'Support ticket triage',
    blurb: 'The canonical example: one choice, one score and one boolean against a structured ticket.',
    state: {
      subject: 'Stripe sync broken since Monday',
      message:
        'Our Stripe connection has failed for three days. Invoices are not being created and we have customers asking why they were not billed. We are on the Pro plan. Can someone look at this ASAP? If we lose this month of revenue I want a credit.',
      plan: 'pro',
      previousTickets: 2,
    },
    questions: {
      department: {
        type: 'choice',
        instructions: 'Which team should handle this ticket?',
        criteria: {
          billing: 'Charges, invoices, and refunds for our own subscription',
          technical: 'Bugs, outages, and integration failures',
          account: 'Login, permissions, and profile changes',
          other: 'Anything that does not fit the other teams',
        },
      },
      severity: {
        type: 'score',
        instructions: 'How severe is the issue for the customer?',
        criteria: [
          'Cosmetic or informational',
          'Degraded, but a workaround exists',
          'Blocking with no workaround',
          'Blocking and causing financial or data loss',
        ],
      },
      requestsRefund: {
        type: 'boolean',
        instructions: 'Is the customer asking for money back or a credit?',
      },
    },
  },
  {
    id: 'tool-approval',
    title: 'Agent tool-call approval',
    blurb: 'Gate an agent: is the proposed tool call in scope, is it destructive, how risky is it?',
    state: {
      userRequest: 'Clean up the old preview deployments for the marketing site, they are cluttering the dashboard.',
      agentPlan: 'List deployments older than 30 days for project marketing-site, then delete them.',
      proposedToolCall: {
        name: 'deleteDeployments',
        arguments: { project: 'marketing-site', filter: { olderThanDays: 30 }, includeProduction: true },
      },
      environment: { productionDeploymentAgeDays: 41 },
    },
    questions: {
      inScope: {
        type: 'boolean',
        instructions: 'Does the proposed tool call do only what the user asked for?',
        criteria: {
          true: 'Every effect of the call was requested or is clearly implied by the request.',
          false: 'The call has effects beyond the request, or targets things the user did not mention.',
        },
      },
      destructive: {
        type: 'boolean',
        instructions: 'Would this call irreversibly remove or modify something a user depends on?',
      },
      risk: {
        type: 'score',
        instructions: 'How risky is it to execute this call without asking the user?',
        criteria: [
          'Safe: read-only or trivially reversible',
          'Low: reversible, limited blast radius',
          'Medium: hard to reverse or touches shared resources',
          'High: irreversible or affects production',
        ],
      },
    },
  },
  {
    id: 'citation',
    title: 'RAG citation check',
    blurb: 'Does the cited passage actually support the claim? Useful as a post-generation verifier.',
    state: {
      claim: 'Jev charges only for input tokens and supports up to 255 options in a choice question.',
      citedPassage:
        'Pricing is $0.042 per million input tokens; output tokens are not billed. Choice questions accept up to 255 named options, and score rubrics accept between 2 and 10 levels.',
    },
    questions: {
      support: {
        type: 'choice',
        instructions: 'How does the cited passage relate to the claim?',
        criteria: {
          supported: 'Every part of the claim is stated in the passage.',
          partially_supported: 'Some parts of the claim are stated; others are absent.',
          contradicted: 'The passage states something incompatible with the claim.',
          not_addressed: 'The passage does not discuss the claim.',
        },
      },
    },
  },
  {
    id: 'incident',
    title: 'Incident routing (with abstain)',
    blurb: 'Timestamped evidence kept separate from the question, plus an explicit insufficient-evidence option.',
    state: {
      observations: [
        { at: '14:02:11Z', source: 'synthetic-check', text: 'Checkout page returned 200 but the "Pay" button did not render.' },
        { at: '14:03:40Z', source: 'payments-api', text: 'p50 latency 110ms, error rate 0.1% (baseline).' },
        { at: '14:04:02Z', source: 'cdn', text: 'Deploy web@8f2c1 promoted to 100% at 13:58Z.' },
        { at: '14:05:17Z', source: 'browser-errors', text: "TypeError: Cannot read properties of undefined (reading 'mount') in checkout.bundle.js" },
      ],
    },
    questions: {
      owner: {
        type: 'choice',
        instructions: 'Which team most likely owns the root cause of this incident?',
        criteria: {
          payments: 'Payment processing backend or provider',
          storefront: 'Frontend web application code or its deploys',
          infrastructure: 'CDN, DNS, networking, or hosting',
          insufficient_evidence: 'The observations do not distinguish between the teams.',
        },
      },
    },
  },
  {
    id: 'judge',
    title: 'LLM answer judge',
    blurb: 'Grade another model’s output: relevance, faithfulness to context, and tone.',
    state: {
      context: 'Our refund window is 30 days from delivery. Opened software licenses are not refundable.',
      userQuestion: 'I bought a license key 10 days ago and activated it, can I get a refund?',
      assistantAnswer:
        'Yes! You are well within our 30-day refund window, so just reply with your order number and we will process it right away.',
    },
    questions: {
      answersQuestion: { type: 'boolean', instructions: 'Does the assistant answer directly address the user’s question?' },
      faithful: {
        type: 'boolean',
        instructions: 'Is every factual statement in the assistant answer consistent with the context?',
      },
      tone: {
        type: 'score',
        instructions: 'Rate the tone of the assistant answer for a customer support setting.',
        criteria: ['Rude or dismissive', 'Neutral but curt', 'Polite', 'Warm and helpful'],
      },
    },
  },
  {
    id: 'conversation',
    title: 'Conversation state (array)',
    blurb: 'State can be a message array. Detect intent and frustration across a whole thread.',
    state: [
      { role: 'user', content: 'Hi, my export to CSV keeps timing out.' },
      { role: 'assistant', content: 'Sorry about that! Could you try exporting a smaller date range?' },
      { role: 'user', content: 'I already did that yesterday when your colleague told me to. Still broken.' },
      { role: 'assistant', content: 'Understood. Could you clear your browser cache and try again?' },
      { role: 'user', content: 'This is the third time I am being told to do basic stuff. Should I just cancel?' },
    ],
    questions: {
      frustration: {
        type: 'score',
        instructions: 'How frustrated is the user by the end of the conversation?',
        criteria: ['Calm', 'Mildly annoyed', 'Clearly frustrated', 'Angry or about to churn'],
      },
      churnRisk: { type: 'boolean', instructions: 'Is the user considering cancelling?' },
      nextStep: {
        type: 'choice',
        instructions: 'What should happen next in this conversation?',
        criteria: {
          continue_troubleshooting: 'The bot should keep suggesting fixes.',
          escalate_to_human: 'Hand off to a human support engineer.',
          offer_retention: 'Offer a discount or retention incentive.',
        },
      },
    },
  },
  {
    id: 'rerank',
    title: 'Search relevance',
    blurb: 'Score a query/document pair. Run one call per candidate to rerank search results.',
    state: {
      query: 'how do I rotate an API key without downtime',
      document:
        'API keys can be created from Settings → Tokens. Each project supports two active keys at once, so you can deploy the new key, confirm traffic, then revoke the old one.',
    },
    questions: {
      relevance: {
        type: 'score',
        instructions: 'How well does the document answer the query?',
        criteria: [
          'Irrelevant',
          'Same topic, does not answer',
          'Partially answers',
          'Fully answers the query',
        ],
      },
    },
  },
];
