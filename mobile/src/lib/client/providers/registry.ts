import type { Provider, ProviderId } from '../provider';
import { komootProvider } from './komoot';
import { stravaProvider } from './strava';

const REGISTRY: Record<ProviderId, Provider> = {
  komoot: komootProvider,
  strava: stravaProvider
};

export function getProvider(id: ProviderId): Provider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export function availableProviders(): Provider[] {
  return Object.values(REGISTRY).filter(Boolean);
}
