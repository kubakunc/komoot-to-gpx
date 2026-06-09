import type { Coordinate } from './komoot';

/**
 * Minimal GPX track parser — used for Strava routes, whose list response carries
 * only a static map image (no coordinates). We download the route's export GPX
 * and pull out the name + track points for the detail map and elevation.
 */
export function parseGpxTrack(xml: string): { name: string; coords: Coordinate[] } {
  const nameMatch = /<name>([^<]*)<\/name>/i.exec(xml);
  const name = nameMatch ? decodeEntities(nameMatch[1].trim()) : '';

  const coords: Coordinate[] = [];
  const ptRe = /<trkpt\b[^>]*\blat="([\-0-9.]+)"[^>]*\blon="([\-0-9.]+)"[^>]*>([\s\S]*?)<\/trkpt>|<trkpt\b[^>]*\blat="([\-0-9.]+)"[^>]*\blon="([\-0-9.]+)"[^>]*\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = ptRe.exec(xml)) !== null) {
    const lat = Number(m[1] ?? m[4]);
    const lng = Number(m[2] ?? m[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const c: Coordinate = { lat, lng };
    const inner = m[3];
    if (inner) {
      const ele = /<ele>([\-0-9.]+)<\/ele>/i.exec(inner);
      if (ele) c.alt = Number(ele[1]);
    }
    coords.push(c);
  }
  return { name, coords };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
