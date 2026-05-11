import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toGpx } from '../../src/lib/client/gpx';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

describe('toGpx', () => {
  it('renders metadata, trk name, type and trkpts with ele/time matching the fixture', () => {
    const out = toGpx(
      {
        name: 'Test & ride',
        sport: 'racebike',
        startTimeIso: '2026-05-01T08:00:00Z'
      },
      [
        { lat: 52.52, lng: 13.405, alt: 34.0, t: '2026-05-01T08:00:00Z' },
        { lat: 52.521, lng: 13.406, alt: 35.5, t: '2026-05-01T08:00:30Z' }
      ]
    );

    expect(out.trim()).toBe(fixture('expected.gpx').trim());
  });

  it('escapes XML special characters in name', () => {
    const out = toGpx(
      { name: 'a < b > "c" & \'d\'', sport: 'hike', startTimeIso: '2026-01-01T00:00:00Z' },
      [{ lat: 0, lng: 0 }]
    );
    expect(out).toContain('a &lt; b &gt; &quot;c&quot; &amp; &apos;d&apos;');
    expect(out).not.toContain('a < b');
  });

  it('omits ele and time when absent on a coordinate', () => {
    const out = toGpx(
      { name: 'plain', sport: 'hike', startTimeIso: '2026-01-01T00:00:00Z' },
      [{ lat: 1, lng: 2 }]
    );
    expect(out).toContain('<trkpt lat="1.0000000" lon="2.0000000"></trkpt>');
    expect(out).not.toContain('<ele>');
    expect(out).not.toContain('<time>2026-05');
  });

  it('handles empty coordinates list', () => {
    const out = toGpx(
      { name: 'empty', sport: 'hike', startTimeIso: '2026-01-01T00:00:00Z' },
      []
    );
    expect(out).toContain('<trkseg>');
    expect(out).toContain('</trkseg>');
    expect(out).not.toContain('<trkpt');
  });
});
