# Jev Lab

A local test bench for TypeSafe AI's Jev (`typesafe-ai/jev`), called through Vercel AI Gateway with AI SDK 7's `experimental_evaluate`.

## Setup

```bash
echo 'AI_GATEWAY_API_KEY=your_key' > .env.local
pnpm dev
```

Create the key under AI Gateway → API Keys in the Vercel dashboard. Instead of a key, you can run `vercel link && vercel env pull .env.local`, which writes a `VERCEL_OIDC_TOKEN` that expires after 12 hours.

## Deploying

On Vercel the app authenticates to AI Gateway with the project's OIDC token, so no API key is needed. Access is gated by `proxy.ts`: every page redirects to `/login` and every API route returns 401 until the visitor enters the password. Set two environment variables on the project:

- `SITE_PASSWORD`: the shared password. It is only read on the server.
- `AUTH_SECRET`: a random string (`openssl rand -hex 32`) used to sign the 30-day session cookie. Rotate it to sign everyone out.

If either is missing, production returns a 500 rather than serving the site unprotected. Locally, the gate is off unless both are set.

## Tabs

- **Guide**: question types, limits, pricing, practices, and pitfalls, taken from the Vercel and TypeSafe docs.
- **Playground**: seven scenarios (triage, tool-call approval, citation check, incident routing, LLM judge, conversation, relevance). You can edit the state and questions, run them, and copy the generated AI SDK or curl code.
- **Experiments**: side-by-side variant runs that test how Jev responds to criteria wording, option order, an abstain option, negation, question bundling, state shape, and rubric granularity.
- **Calibration**: runs a labeled dataset (32 routing tickets or 20 tool calls) and shows accuracy, a reliability diagram, a threshold sweep of automated vs reviewed items, and a confusion matrix.
- **Jev vs LLM**: runs the same decision through an LLM with structured output, repeated ×N, to compare latency, cost, and run-to-run stability.

## Code map

- `lib/jev.ts`: the single `evaluate()` call, plus extraction of cost and confidence.
- `app/api/evaluate`, `app/api/compare`: server routes, so the key never reaches the browser.
- `lib/presets.ts`, `lib/lessons.ts`, `lib/datasets.ts`: the scenarios, experiments, and labeled data. Edit these to test your own use case.
