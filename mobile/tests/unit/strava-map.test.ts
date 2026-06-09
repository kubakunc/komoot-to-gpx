import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseActivityList, toActivitySummary, latlngToCoordinates
} from '../../src/lib/client/providers/strava-map';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

describe('strava-map.toActivitySummary', () => {
  it('maps a public GPS ride', () => {
    const s = toActivitySummary({
      id: 5, name: 'Ride', sport_type: 'Ride', start_time: '2026-06-08T14:38:34+0000',
      distance_raw: 59297.1, has_latlng: true, private: false, visibility: 'everyone'
    });
    expect(s).toMatchObject({
      id: '5', name: 'Ride', sport: 'Ride', distance: 59297.1, kind: 'recorded', status: 'public'
    });
  });

  it('marks private activities and humanizes camelCase sports', () => {
    const s = toActivitySummary({ id: 6, name: 'X', sport_type: 'MountainBikeRide', private: true, visibility: 'only_me' });
    expect(s.status).toBe('private');
    expect(s.sport).toBe('MTB');
    const t = toActivitySummary({ id: 7, name: 'Y', sport_type: 'SomeNewSport' });
    expect(t.sport).toBe('Some New Sport');
  });
});

describe('strava-map.parseActivityList', () => {
  it('parses the training_activities fixture into summaries', () => {
    const page = parseActivityList(fixture('strava-training-activities.sample.json'), 0, 20);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ id: '1000000000001', kind: 'recorded', status: 'public' });
    expect(page.items[1]).toMatchObject({ id: '1000000000002', status: 'private' });
    // 2 rows < perPage(20) ⇒ no further page
    expect(page.totalPages).toBe(1);
  });

  it('infers a next page when a full page is returned', () => {
    const body = JSON.stringify({ models: Array.from({ length: 20 }, (_, i) => ({ id: i, name: 'n' })) });
    expect(parseActivityList(body, 0, 20).totalPages).toBe(2);
  });

  it('returns an empty page on malformed JSON', () => {
    expect(parseActivityList('not json', 0, 20)).toEqual({ items: [], page: 0, totalPages: 1 });
  });
});

describe('strava-map.latlngToCoordinates', () => {
  it('maps the streams fixture into coordinates', () => {
    const coords = latlngToCoordinates(fixture('strava-activity-detail.sample.json'));
    expect(coords).toHaveLength(7);
    expect(coords[0]).toEqual({ lat: 52.25464, lng: 21.073753 });
  });

  it('returns empty on malformed JSON or missing latlng', () => {
    expect(latlngToCoordinates('nope')).toEqual([]);
    expect(latlngToCoordinates('{}')).toEqual([]);
  });
});
