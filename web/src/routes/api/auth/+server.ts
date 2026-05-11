import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { login, KomootError } from '$lib/server/komoot';
import { createRateLimiter } from '$lib/server/rate-limit';

const limiter = createRateLimiter({
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5),
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_S ?? 60) * 1000
});

interface AuthBody {
  email?: unknown;
  password?: unknown;
}

export const POST: RequestHandler = async ({ request, getClientAddress, setHeaders }) => {
  const ip = getClientAddress();
  const r = limiter.check(ip);
  if (!r.ok) {
    setHeaders({ 'Retry-After': String(Math.ceil(r.retryAfterMs / 1000)) });
    error(429, 'too many login attempts, try again later');
  }

  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    error(400, 'invalid JSON body');
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    error(400, 'email and password required');
  }

  try {
    const result = await login(email, password);
    return json({ userId: result.userId, token: result.token });
  } catch (e) {
    if (e instanceof KomootError) {
      error(e.status, e.message);
    }
    error(502, 'unexpected error reaching komoot');
  }
};
