<script lang="ts">
  import { getConnectedProviders, getProviderSession, setProviderSession, clearProviderSession } from '$lib/client/session';
  import { setActiveProvider, activeProvider } from '$lib/client/active-provider';
  import { getProvider, availableProviders } from '$lib/client/providers/registry';
  import type { ProviderId } from '$lib/client/provider';
  import { track, EVENTS } from '$lib/client/analytics';

  let { onSignedOut }: { onSignedOut: () => void } = $props();

  let open = $state(false);
  let connected = $state<ProviderId[]>([]);
  let labels = $state<Record<string, string>>({});
  let busy = $state<ProviderId | null>(null);
  let root = $state<HTMLElement | undefined>(undefined);

  // Close when tapping anywhere outside the menu. A fixed-position scrim can't
  // be used here: the header's backdrop-filter makes `position: fixed` resolve
  // against the header, so it would only cover the header bar.
  function onWindowPointerDown(e: Event) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  async function refresh() {
    connected = await getConnectedProviders();
    const next: Record<string, string> = {};
    for (const p of connected) {
      const s = await getProviderSession(p);
      next[p] = s?.displayName ?? getProvider(p).label;
    }
    labels = next;
  }

  // Re-sync connected providers + labels whenever the active source changes
  // (after connect/switch) so rows never show a stale connect-vs-switch state.
  $effect(() => {
    void $activeProvider;
    void refresh();
  });

  function toggle() {
    open = !open;
    if (open) void refresh(); // always fresh when shown
  }

  function switchTo(id: ProviderId) {
    open = false;
    if (id === $activeProvider) return;
    setActiveProvider(id);
  }

  async function connect(id: ProviderId) {
    busy = id;
    try {
      const session = await getProvider(id).login();
      await setProviderSession(session);
      setActiveProvider(id);
      void track(EVENTS.LOGIN_SUCCESS, { provider: id });
      await refresh();
      open = false;
    } catch (e) {
      const err = e as Error;
      if (err?.name !== 'AuthCancelledError') {
        void track(EVENTS.LOGIN_FAIL, { provider: id, reason: 'error' });
      }
    } finally {
      busy = null;
    }
  }

  async function signOut() {
    open = false;
    for (const p of await getConnectedProviders()) await clearProviderSession(p);
    onSignedOut();
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="menu" bind:this={root}>
  <button class="trigger" onclick={toggle} aria-haspopup="menu" aria-expanded={open}>
    {getProvider($activeProvider).label}
    <span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="dropdown" role="menu">
      {#each availableProviders() as p (p.id)}
        {#if connected.includes(p.id)}
          <button class="row" role="menuitem" onclick={() => switchTo(p.id)}>
            <span class="dot" class:active={p.id === $activeProvider}></span>
            {p.label}{#if labels[p.id] && labels[p.id] !== p.label}<span class="who"> · {labels[p.id]}</span>{/if}
          </button>
        {:else}
          <button class="row" role="menuitem" disabled={busy !== null} onclick={() => connect(p.id)}>
            <span class="dot"></span>
            {busy === p.id ? `Connecting ${p.label}…` : `Connect ${p.label}`}
          </button>
        {/if}
      {/each}
      <div class="sep"></div>
      <button class="row signout" role="menuitem" onclick={signOut}>Sign out</button>
    </div>
  {/if}
</div>

<style>
  .menu { position: relative; }
  .trigger {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.85rem; font-weight: 600; color: var(--color-fg);
    background: var(--color-bg); border: 1px solid var(--color-border);
    border-radius: var(--radius-full); padding: 0.35rem 0.8rem; cursor: pointer;
  }
  .trigger:hover { border-color: var(--color-fg); }
  .caret { font-size: 0.7rem; color: var(--color-fg-muted); }
  .dropdown {
    position: absolute; right: 0; top: calc(100% + 0.4rem); z-index: 21;
    min-width: 220px; background: var(--color-surface);
    border: 1px solid var(--color-border); border-radius: var(--radius);
    box-shadow: var(--shadow-md); padding: 0.35rem; display: flex; flex-direction: column;
  }
  .row {
    display: flex; align-items: center; gap: 0.55rem;
    width: 100%; text-align: left; background: transparent; border: 0;
    padding: 0.6rem 0.7rem; font-size: 0.88rem; color: var(--color-fg);
    border-radius: var(--radius-sm); cursor: pointer;
  }
  .row:hover { background: var(--color-bg-soft); }
  .row:disabled { opacity: 0.6; cursor: progress; }
  .who { color: var(--color-fg-muted); font-weight: 400; }
  .dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--color-border-strong); flex-shrink: 0; }
  .dot.active { background: var(--color-fg); border-color: var(--color-fg); }
  .sep { height: 1px; background: var(--color-border); margin: 0.35rem 0.2rem; }
  .signout { color: var(--color-fg-muted); }
</style>
