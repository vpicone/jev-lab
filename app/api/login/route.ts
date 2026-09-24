import { AUTH_COOKIE, SESSION_MAX_AGE_S, authConfig, createSession, passwordMatches } from '@/lib/auth';

const redirect = (request: Request, path: string, cookie?: string) => {
  const headers = new Headers({ Location: new URL(path, request.url).toString() });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
};

export async function POST(request: Request) {
  const config = authConfig();
  const form = await request.formData();
  const candidate = String(form.get('password') ?? '');

  if (!config || !(await passwordMatches(candidate, config.password, config.secret))) {
    await new Promise((r) => setTimeout(r, 1000));
    return redirect(request, '/login?error=1');
  }

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = `${AUTH_COOKIE}=${await createSession(config.secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_S}${secure}`;
  return redirect(request, '/', cookie);
}
