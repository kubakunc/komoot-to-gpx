import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getTour, getCoordinates, KomootError } from '$lib/server/komoot';

function parseBasicAuth(h: string | null): { email: string; token: string } {
  if (!h || !h.startsWith('Basic ')) error(401, 'missing basic auth');
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) error(401, 'invalid basic auth');
  return { email: decoded.slice(0, idx), token: decoded.slice(idx + 1) };
}

function downsample<T>(arr: T[], target: number): T[] {
  if (arr.length <= target) return arr;
  const step = (arr.length - 1) / (target - 1);
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    out.push(arr[Math.round(i * step)]);
  }
  return out;
}

const MAX_POINTS = 160;

export const GET: RequestHandler = async ({ request, params }) => {
  const auth = parseBasicAuth(request.headers.get('authorization'));
  const tourId = params.id;
  if (!tourId) error(400, 'missing tour id');

  try {
    const meta = await getTour(auth, tourId);
    const coords = await getCoordinates(auth, tourId, meta.date);
    const simplified = downsample(coords, MAX_POINTS).map((c) => ({ lat: c.lat, lng: c.lng }));
    return json({ coords: simplified });
  } catch (e) {
    if (e instanceof KomootError) error(e.status, e.message);
    error(502, 'unexpected error reaching komoot');
  }
};
