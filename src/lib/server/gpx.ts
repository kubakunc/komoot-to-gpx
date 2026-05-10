export interface GpxMetadata {
  name: string;
  sport: string;
  startTimeIso: string;
}

export interface GpxCoordinate {
  lat: number;
  lng: number;
  alt?: number;
  t?: string;
}

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const fixed = (n: number, digits = 7) => n.toFixed(digits);

const renderPoint = (c: GpxCoordinate): string => {
  const inner: string[] = [];
  if (c.alt !== undefined) inner.push(`<ele>${c.alt.toFixed(1)}</ele>`);
  if (c.t !== undefined) inner.push(`<time>${escape(c.t)}</time>`);
  return `      <trkpt lat="${fixed(c.lat)}" lon="${fixed(c.lng)}">${inner.join('')}</trkpt>`;
};

export function toGpx(meta: GpxMetadata, coords: GpxCoordinate[]): string {
  const name = escape(meta.name);
  const points = coords.map(renderPoint).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="komoot-to-gpx" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${escape(meta.startTimeIso)}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>${escape(meta.sport)}</type>
    <trkseg>${points ? '\n' + points + '\n    ' : ''}</trkseg>
  </trk>
</gpx>
`;
}
