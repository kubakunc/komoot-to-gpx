<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getConnectedProviders, getProviderSession } from '$lib/client/session';
  import { getActiveProvider, setActiveProvider, activeProvider, resolveActiveProvider } from '$lib/client/active-provider';
  import { initAds } from '$lib/client/ad-banner';
  import { readShareHash, setPendingShare, markViaShare,
    consumeNativeShareToken, clearNativeShareToken, type ShareTarget } from '$lib/client/share-intent';
  import { track, EVENTS } from '$lib/client/analytics';
  import SourceMenu from '$lib/client/SourceMenu.svelte';
  import '../app.css';

  let { children } = $props();

  let ready = $state(false);
  let userLabel = $state<string | null>(null);
  let bootError = $state<string | null>(null);

  /** Sync the header label to the active provider's session (falls back to the first connected). */
  async function refreshUserLabel() {
    const connected = await getConnectedProviders();
    if (connected.length === 0) { userLabel = null; return; }
    const active = resolveActiveProvider(connected, getActiveProvider());
    if (active !== getActiveProvider()) setActiveProvider(active);
    const s = await getProviderSession(active);
    userLabel = s?.displayName ?? null;
  }

  async function routeToTarget(target: ShareTarget) {
    await clearNativeShareToken(); // handled — don't let the persistent token replay later
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setActiveProvider(target.provider);
    const s = await getProviderSession(target.provider);
    void track(EVENTS.SHARE_INTENT_RECEIVED, { provider: target.provider, signed_in: !!s });
    markViaShare(target.id);
    if (s) {
      await goto(`/tour/${target.id}`);
    } else {
      setPendingShare(target);
      await goto('/login', { replaceState: true });
    }
  }

  /** Warm-start path: the native layer injected a #share=… hash into the running app. */
  async function handleShareHash() {
    const target = readShareHash(window.location.hash);
    if (!target) return false;
    await routeToTarget(target);
    return true;
  }

  /** Cold-start path: read the token the native layer persisted to Preferences. */
  async function handleNativeShare() {
    const target = await consumeNativeShareToken();
    if (!target) return false;
    await routeToTarget(target);
    return true;
  }

  onMount(async () => {
    try {
      // Warm start: the native layer injects a #share hash into the running app.
      window.addEventListener('hashchange', () => { void handleShareHash(); });
      void initAds();
      const connected = await getConnectedProviders();
      // Try the hash (if it survived boot), then the persistent native token
      // (cold-start safe — survives the WebView load and SvelteKit URL reset).
      const handled = (await handleShareHash()) || (await handleNativeShare());
      if (!handled) {
        const path = $page.url.pathname;
        if (connected.length === 0 && path !== '/login') {
          await goto('/login', { replaceState: true });
        } else if (connected.length > 0 && path === '/login') {
          await goto('/', { replaceState: true });
        }
      }
    } catch (e) {
      const err = e as Error;
      bootError = `${err?.name ?? 'Error'}: ${err?.message ?? String(e)}\n${err?.stack ?? ''}`;
    } finally {
      ready = true;
    }
  });

  // Keep the header menu's label in sync whenever the active source changes
  // (sign-in on /login) or we navigate (e.g. a cleared session → /login should
  // drop the menu). Both are tracked so the menu never shows a stale state.
  $effect(() => {
    void $activeProvider;
    void $page.url.pathname;
    void refreshUserLabel();
  });
</script>

<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="/">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4.4 10.6 C6 10.6 6.6 8.6 8.2 9 C9.4 9.2 10 11.8 11.6 10.4 C12.8 9.4 13.8 7 15.4 6.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="4.4" cy="10.6" r="1.4" fill="currentColor" />
        <circle cx="15.4" cy="6.6" r="1.4" fill="currentColor" />
      </svg>
      <span>Export GPX</span>
    </a>
    <nav class="nav">
      {#if userLabel}
        <SourceMenu onSignedOut={() => { userLabel = null; goto('/login', { replaceState: true }); }} />
      {/if}
    </nav>
  </div>
</header>

{#if bootError}
  <main>
    <h2>Boot error</h2>
    <pre style="white-space: pre-wrap; font-size: 0.75rem; color: #c00; background: #fff5f5; padding: 1rem; border-radius: 4px;">{bootError}</pre>
  </main>
{:else if ready}
  <main>
    {@render children()}
  </main>
{/if}

<style>
  .app-header {
    border-bottom: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    position: sticky; top: 0; z-index: 10;
    padding-top: env(safe-area-inset-top);
  }
  .app-header-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 0.85rem 1.25rem;
    display: flex; align-items: center; gap: 1rem;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-weight: 600; font-size: 0.95rem; color: var(--color-fg);
  }
  .nav { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }
  main {
    max-width: 1100px; margin: 0 auto;
    padding: 1.5rem
      max(1.25rem, env(safe-area-inset-right))
      max(4rem, calc(4rem + env(safe-area-inset-bottom)))
      max(1.25rem, env(safe-area-inset-left));
  }
</style>
