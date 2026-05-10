import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { listTours, KomootError } from '$lib/server/komoot';

function parseBasicAuth(authHeader: string | null): { email: string; token: string } {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    error(401, 'missing basic auth');
  }
  const decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) error(401, 'invalid basic auth');
  return { email: decoded.slice(0, idx), token: decoded.slice(idx + 1) };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const auth = parseBasicAuth(request.headers.get('authorization'));
  const userId = request.headers.get('x-user-id') ?? '';
  if (!userId) error(400, 'X-User-Id header required');

  const page = Number(url.searchParams.get('page') ?? '0');
  if (!Number.isInteger(page) || page < 0) error(400, 'invalid page');

  try {
    const result = await listTours(auth, { userId, page });
    return json(result);
  } catch (e) {
    if (e instanceof KomootError) error(e.status, e.message);
    error(502, 'unexpected error reaching komoot');
  }
};
