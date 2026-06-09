import { describe, it, expect } from 'vitest';
import { parseGpxTrack } from '../../src/lib/client/strava-gpx';

const GPX = `<?xml version="1.0"?>
<gpx creator="StravaGPX"><metadata><name>Sample &amp; Loop</name></metadata>
<trk><name>Sample &amp; Loop</name><trkseg>
<trkpt lat="52.1" lon="21.0"><ele>100.5</ele></trkpt>
<trkpt lat="52.2" lon="21.1"><ele>110.0</ele></trkpt>
<trkpt lat="52.3" lon="21.2"></trkpt>
</trkseg></trk></gpx>`;

describe('strava-gpx.parseGpxTrack', () => {
  it('extracts the name (entity-decoded) and track points with elevation', () => {
    const { name, coords } = parseGpxTrack(GPX);
    expect(name).toBe('Sample & Loop');
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual({ lat: 52.1, lng: 21.0, alt: 100.5 });
    expect(coords[2]).toEqual({ lat: 52.3, lng: 21.2 }); // no <ele> ⇒ no alt
  });

  it('returns empty coords for non-GPX input', () => {
    expect(parseGpxTrack('nope').coords).toEqual([]);
  });
});
