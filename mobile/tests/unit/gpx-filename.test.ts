import { describe, it, expect } from 'vitest';
import { gpxFilename } from '../../src/lib/client/gpx-filename';

describe('gpxFilename', () => {
  it('keeps letters, numbers, spaces→underscores and adds .gpx', () => {
    expect(gpxFilename('Evening Ride')).toBe('Evening_Ride.gpx');
  });
  it('strips punctuation but keeps unicode letters', () => {
    expect(gpxFilename('zalew zegrzyński!')).toBe('zalew_zegrzyński.gpx');
  });
  it('falls back to tour.gpx when nothing usable remains', () => {
    expect(gpxFilename('***')).toBe('tour.gpx');
    expect(gpxFilename('')).toBe('tour.gpx');
  });
});
