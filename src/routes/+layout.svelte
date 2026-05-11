<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getSession, clearSession } from '$lib/client/session';
  import '../app.css';

  let { children } = $props();

  let ready = $state(false);
  let email = $state<string | null>(null);

  onMount(() => {
    const s = getSession();
    const path = $page.url.pathname;
    if (!s && path !== '/login') {
      goto('/login', { replaceState: true });
      return;
    }
    if (s && path === '/login') {
      goto('/', { replaceState: true });
      return;
    }
    email = s?.email ?? null;
    ready = true;
  });

  function logout() {
    clearSession();
    email = null;
    goto('/login', { replaceState: true });
  }
</script>

<header class="app-header">
  <a class="brand" href="/">
    <span class="mark">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <path d="M2 18 L7 6 L11 14 L15 8 L20 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span class="brand-text">
      <span class="brand-display">Komoot</span><span class="brand-arrow">⟶</span><span class="brand-display">GPX</span>
    </span>
  </a>
  {#if email}
    <span class="divider"></span>
    <span class="user" title={email}>{email}</span>
    <button class="logout" onclick={logout}>wyloguj</button>
  {/if}
</header>

{#if ready}
  <main>
    {@render children()}
  </main>
{/if}

<footer class="app-footer">
  <span>©&nbsp;{new Date().getFullYear()} eksport prywatnych tras z Komoota</span>
  <span class="dot">·</span>
  <span>mapy © OpenStreetMap</span>
</footer>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
    background: rgba(244, 238, 224, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .brand {
    display: flex; align-items: center; gap: 0.6rem;
    text-decoration: none;
    color: var(--color-ink);
  }
  .mark {
    display: inline-flex;
    width: 32px; height: 32px;
    align-items: center; justify-content: center;
    background: var(--color-ink);
    color: var(--color-paper);
    border-radius: 50%;
  }
  .brand-text {
    font-family: var(--font-display);
    font-size: 1.05rem;
    letter-spacing: 0.02em;
    font-weight: 500;
  }
  .brand-display { font-variation-settings: 'opsz' 144, 'SOFT' 30; }
  .brand-arrow { color: var(--color-terra); margin: 0 0.3em; font-family: var(--font-body); }
  .divider {
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--border-subtle), transparent);
    margin: 0 0.5rem;
  }
  .user {
    color: var(--color-ink-soft);
    font-size: 0.85rem;
    letter-spacing: 0.01em;
    max-width: 22ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .logout {
    background: transparent;
    color: var(--color-ink-soft);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    padding: 0.3rem 0.8rem;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: lowercase;
    transition: border-color 0.15s, color 0.15s;
  }
  .logout:hover { border-color: var(--color-terra); color: var(--color-terra); }

  main {
    max-width: 980px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
  }

  .app-footer {
    max-width: 980px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 2rem;
    color: var(--color-ink-soft);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .dot { color: var(--color-sage); }

  @media (max-width: 540px) {
    .user { display: none; }
  }
</style>
