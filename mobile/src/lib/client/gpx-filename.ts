/** Sanitise an activity name into a safe `<name>.gpx` filename. */
export function gpxFilename(name: string): string {
  const base = name.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '_') || 'tour';
  return `${base}.gpx`;
}
