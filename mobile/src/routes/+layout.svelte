<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSession, clearSession } from '$lib/client/session';
  import { initAds } from '$lib/client/ad-banner';
  import { readShareHash, setPendingShare, markViaShare } from '$lib/client/share-intent';
  import { track, EVENTS } from '$lib/client/analytics';
  import '../app.css';

  let { children } = $props();

  let ready = $state(false);
  let userLabel = $state<string | null>(null);
  let bootError = $state<string | null>(null);

  async function handleShareHash() {
    const tourId = readShareHash(window.location.hash);
    if (!tourId) return false;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    const s = await getSession();
    void track(EVENTS.SHARE_INTENT_RECEIVED, { signed_in: !!s });
    markViaShare(tourId);
    if (s) {
      await goto(`/tour/${tourId}`);
    } else {
      setPendingShare(tourId);
      await goto('/login', { replaceState: true });
    }
    return true;
  }

  onMount(async () => {
    try {
      void initAds();
      const s = await getSession();
      userLabel = s?.email ?? null;
      const handled = await handleShareHash();
      if (!handled) {
        const path = $page.url.pathname;
        if (!s && path !== '/login') {
          await goto('/login', { replaceState: true });
        } else if (s && path === '/login') {
          await goto('/', { replaceState: true });
        }
      }
      window.addEventListener('hashchange', () => { void handleShareHash(); });
    } catch (e) {
      const err = e as Error;
      bootError = `${err?.name ?? 'Error'}: ${err?.message ?? String(e)}\n${err?.stack ?? ''}`;
    } finally {
      ready = true;
    }
  });

  async function signOut() {
    await clearSession();
    userLabel = null;
    goto('/login', { replaceState: true });
  }
</script>

<header class="app-header">
  <div class="app-header-inner">
    <a class="brand" href="/">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2 16 L6 6 L10 12 L14 7 L18 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>Export GPX</span>
    </a>
    <nav class="nav">
      <a class="nav-link" href="https://www.komoot.com" target="_blank" rel="noopener noreferrer">
        Komoot
      </a>
      {#if userLabel}
        <span class="user">{userLabel}</span>
        <button class="logout" onclick={signOut}>Sign out</button>
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
  .nav-link {
    font-size: 0.85rem; color: var(--color-fg-muted);
    padding: 0.4rem 0.7rem; border-radius: var(--radius-sm);
    transition: color 0.15s, background 0.15s;
  }
  .nav-link:hover { color: var(--color-fg); background: var(--color-bg-soft); }
  .user {
    color: var(--color-fg-muted); font-size: 0.85rem;
    max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding-left: 0.75rem; border-left: 1px solid var(--color-border);
  }
  .logout {
    background: transparent; color: var(--color-fg-muted);
    border: 1px solid var(--color-border); border-radius: var(--radius-full);
    padding: 0.35rem 0.85rem; font-size: 0.82rem;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .logout:hover { border-color: var(--color-fg); color: var(--color-fg); background: var(--color-bg-soft); }
  main {
    max-width: 1100px; margin: 0 auto;
    padding: 1.5rem
      max(1.25rem, env(safe-area-inset-right))
      max(4rem, calc(4rem + env(safe-area-inset-bottom)))
      max(1.25rem, env(safe-area-inset-left));
  }
  @media (max-width: 560px) { .user { display: none; } }
</style>
