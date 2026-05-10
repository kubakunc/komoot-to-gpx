import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getTour, getCoordinates, KomootError } from '$lib/server/komoot';
import { toGpx } from '$lib/server/gpx';

function parseBasicAuth(h: string | null): { email: string; token: string } {
  if (!h || !h.startsWith('Basic ')) error(401, 'missing basic auth');
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) error(401, 'invalid basic auth');
  return { email: decoded.slice(0, idx), token: decoded.slice(idx + 1) };
}

const safeFilename = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'tour';

export const GET: RequestHandler = async ({ request, params }) => {
  const auth = parseBasicAuth(request.headers.get('authorization'));
  const tourId = params.id;
  if (!tourId) error(400, 'missing tour id');

  try {
    const meta = await getTour(auth, tourId);
    const coords = await getCoordinates(auth, tourId, meta.date);
    const gpx = toGpx(
      { name: meta.name, sport: meta.sport, startTimeIso: meta.date },
      coords
    );
    const filename = safeFilename(meta.name) + '.gpx';
    return new Response(gpx, {
      status: 200,
      headers: {
        'content-type': 'application/gpx+xml; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    if (e instanceof KomootError) error(e.status, e.message);
    error(502, 'unexpected error reaching komoot');
  }
};
