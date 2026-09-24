type ErrorLike = {
  name?: string;
  message?: string;
  statusCode?: number;
  responseBody?: unknown;
  responseHeaders?: Record<string, string>;
  cause?: unknown;
};

function findRetryAfter(error: ErrorLike | undefined, depth = 0): number | undefined {
  if (!error || depth > 3) return undefined;
  const header = Number(error.responseHeaders?.['retry-after']);
  return Number.isFinite(header) ? header : findRetryAfter(error.cause as ErrorLike | undefined, depth + 1);
}

export function errorResponse(error: unknown) {
  const err = error as ErrorLike;
  const message = err?.message ?? String(error);
  const status = err?.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const missingAuth = /api key|oidc|unauthori[sz]ed|authentication/i.test(message);
  return Response.json(
    {
      error: missingAuth
        ? `${message}\n\nSet AI_GATEWAY_API_KEY in .env.local, or run \`vercel link && vercel env pull .env.local\`.`
        : message,
      retryAfterS: status === 429 ? (findRetryAfter(err) ?? 15) : undefined,
      details: { name: err?.name, statusCode: err?.statusCode, responseBody: err?.responseBody },
    },
    { status },
  );
}
