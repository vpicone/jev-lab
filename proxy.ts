import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, authConfig, isValidSession } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const config = authConfig();
  if (!config) {
    return process.env.NODE_ENV === 'production'
      ? new NextResponse('SITE_PASSWORD and AUTH_SECRET must be configured.', { status: 500 })
      : NextResponse.next();
  }

  if (await isValidSession(request.cookies.get(AUTH_COOKIE)?.value, config.secret)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!login$|api/login$|_next/static|_next/image|favicon.ico).*)'],
};
