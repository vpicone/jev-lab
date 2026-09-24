export const AUTH_COOKIE = 'jevlab_session';
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authConfig() {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  return password && secret ? { password, secret } : null;
}

export async function passwordMatches(candidate: string, password: string, secret: string): Promise<boolean> {
  return timingSafeEqual(await hmac(secret, `pw:${candidate}`), await hmac(secret, `pw:${password}`));
}

export async function createSession(secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S;
  return `${expires}.${await hmac(secret, `session:${expires}`)}`;
}

export async function isValidSession(token: string | undefined, secret: string): Promise<boolean> {
  const [expires, signature] = token?.split('.') ?? [];
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return timingSafeEqual(signature, await hmac(secret, `session:${expires}`));
}
