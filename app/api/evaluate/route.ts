import { runJev } from '@/lib/jev';
import type { EvalRequest } from '@/lib/types';
import { errorResponse } from '@/lib/errors';

export async function POST(request: Request) {
  const body = (await request.json()) as EvalRequest;
  if (!body?.questions || Object.keys(body.questions).length === 0) {
    return Response.json({ error: 'At least one question is required.' }, { status: 400 });
  }
  try {
    return Response.json(await runJev(body));
  } catch (error) {
    return errorResponse(error);
  }
}
