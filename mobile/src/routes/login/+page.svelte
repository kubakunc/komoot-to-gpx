<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getProvider } from '$lib/client/providers/registry';
  import type { ProviderId } from '$lib/client/provider';
  import { setProviderSession } from '$lib/client/session';
  import { setActiveProvider } from '$lib/client/active-provider';
  import { consumePendingShare, setPendingShare } from '$lib/client/share-intent';
  import { showBanner, hideBanner } from '$lib/client/ad-banner';
  import { track, EVENTS } from '$lib/client/analytics';

  let errorMsg = $state<string | null>(null);
  let busy = $state<ProviderId | null>(null);

  onMount(() => {
    void showBanner();
    return () => { void hideBanner(); };
  });

  async function signIn(providerId: ProviderId) {
    errorMsg = null;
    busy = providerId;
    try {
      const session = await getProvider(providerId).login();
      await setProviderSession(session);
      setActiveProvider(providerId);
      void track(EVENTS.LOGIN_SUCCESS, { provider: providerId });
      const pending = consumePendingShare();
      if (pending && pending.provider === providerId) {
        await goto(`/tour/${pending.id}`, { replaceState: true });
      } else {
        if (pending) setPendingShare(pending); // keep it for the matching provider
        await goto('/', { replaceState: true });
      }
    } catch (e) {
      const err = e as Error;
      if (err?.name === 'AuthUnsupportedError') {
        errorMsg = 'Open this in the Android app to sign in.';
      } else if (err?.name === 'AuthCancelledError') {
        errorMsg = null;
        void track(EVENTS.LOGIN_FAIL, { provider: providerId, reason: 'cancelled' });
      } else {
        errorMsg = `Sign-in failed: ${err?.message ?? 'unknown error'}`;
        void track(EVENTS.LOGIN_FAIL, { provider: providerId, reason: 'error' });
      }
    } finally {
      busy = null;
    }
  }
</script>

<section class="auth">
  <h1>Export your tours as GPX.</h1>
  <p class="lede">
    Sign in to Komoot or Strava. A secure login page opens inside the app — we never see your
    password. Your activities stay on your device.
  </p>

  <button onclick={() => signIn('komoot')} disabled={busy !== null} class="cta cta-komoot">
    {#if busy === 'komoot'}
      <span class="spinner" aria-hidden="true"></span>
      Opening Komoot…
    {:else}
      Sign in with Komoot
    {/if}
  </button>

  <button onclick={() => signIn('strava')} disabled={busy !== null} class="cta cta-strava">
    {#if busy === 'strava'}
      <span class="spinner" aria-hidden="true"></span>
      Opening Strava…
    {:else}
      Sign in with Strava
    {/if}
  </button>

  {#if errorMsg}<p class="error">{errorMsg}</p>{/if}

  <aside class="hint">
    <svg class="hint-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <circle cx="17" cy="5.5" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <circle cx="17" cy="18.5" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <path d="M8.3 10.8 L14.7 6.9 M8.3 13.2 L14.7 17.1" stroke="currentColor" stroke-width="1.8" />
    </svg>
    <p class="hint-text">
      <strong>Tip:</strong> from the Komoot app you can also send a tour here —
      open any tour and tap <strong>Share</strong> → <strong>Export GPX</strong>.
      After you sign in once, it opens instantly, ready to save.
    </p>
  </aside>

  <p class="footnote">
    Google, Apple and Facebook sign-in don't work inside embedded browsers —
    use your email and password.
  </p>

  <p class="disclaimer">
    Not affiliated with, endorsed by, or sponsored by komoot GmbH or Strava Inc.
    "Komoot" and "Strava" are trademarks of their respective owners.
  </p>
</section>

<style>
  .auth { max-width: 380px; margin: 3rem auto 0; }
  .lede { color: var(--color-fg-muted); line-height: 1.55; font-size: 0.95rem; margin: 0.5rem 0 2rem; }
  .cta {
    width: 100%; height: 48px; padding: 0 1.1rem;
    background: var(--color-fg); color: var(--color-bg);
    border: 0; border-radius: var(--radius-sm);
    font-size: 1rem; font-weight: 500;
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
    transition: background 0.15s, transform 0.15s;
  }
  .cta + .cta { margin-top: 0.75rem; }
  .cta:hover { background: var(--color-accent); }
  .cta:active { transform: scale(0.99); }
  .cta:disabled { opacity: 0.65; cursor: progress; }
  .cta-strava { background: var(--color-bg); color: var(--color-fg); border: 1px solid var(--color-border-strong); }
  .cta-strava:hover { background: var(--color-bg-soft); }
  .spinner {
    width: 14px; height: 14px;
    border: 1.5px solid currentColor; border-right-color: transparent;
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error { color: var(--color-error); margin: 1rem 0 0; font-size: 0.9rem; }
  .hint {
    display: flex; align-items: flex-start; gap: 0.65rem;
    margin-top: 1.5rem;
    padding: 0.8rem 0.9rem;
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .hint-icon { flex-shrink: 0; margin-top: 0.1rem; color: var(--color-fg-muted); }
  .hint-text {
    margin: 0; font-size: 0.85rem; line-height: 1.5;
    color: var(--color-fg-muted);
  }
  .hint-text strong { color: var(--color-fg); font-weight: 600; }
  .footnote { margin-top: 2rem; color: var(--color-fg-subtle); font-size: 0.85rem; line-height: 1.45; }
  .disclaimer { margin-top: 2.5rem; color: var(--color-fg-subtle); font-size: 0.72rem; line-height: 1.4; }
</style>
