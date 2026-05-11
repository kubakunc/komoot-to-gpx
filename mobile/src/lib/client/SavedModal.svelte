<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { showModalRectangle, hideModalRectangle, showBanner } from './ad-banner';

  let { filename, onClose }: { filename: string; onClose: () => void } = $props();

  onMount(() => {
    void showModalRectangle();
  });

  onDestroy(() => {
    void (async () => {
      await hideModalRectangle();
      await showBanner();
    })();
  });

  function handleClose() {
    onClose();
  }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      onClose();
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKey} />

<div
  class="backdrop"
  onclick={handleBackdrop}
  onkeydown={(e) => e.key === 'Enter' && handleClose()}
  role="dialog"
  aria-modal="true"
  aria-labelledby="saved-title"
  tabindex="-1"
>
  <div class="card">
    <div class="check" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="var(--color-success)" stroke-width="2" />
        <path d="M12 21l5 5 11-12" stroke="var(--color-success)" stroke-width="2.4"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <h2 id="saved-title">Saved!</h2>
    <p class="filename">{filename}</p>
    <p class="hint">Your GPX is ready in the location you picked.</p>

    <!-- Slot reserved for the native AdMob medium-rectangle (300×250),
         which is positioned over the WebView center by the plugin. The
         empty area here keeps the layout from jumping when the ad loads. -->
    <div class="ad-slot" aria-hidden="true">
      <span class="ad-label">Ad</span>
    </div>

    <button class="close" onclick={handleClose}>Done</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    z-index: 1000;
    animation: fadeIn 0.18s ease both;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .card {
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    padding: 1.75rem 1.5rem 1.25rem;
    max-width: 360px;
    width: 100%;
    box-shadow: 0 20px 60px -20px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.2);
    text-align: center;
    animation: popIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes popIn {
    from { opacity: 0; transform: translateY(8px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .check { display: flex; justify-content: center; margin-bottom: 0.5rem; }

  h2 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }

  .filename {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.85rem;
    color: var(--color-fg-muted);
    margin: 0.3rem 0 0.6rem;
    word-break: break-all;
  }

  .hint {
    color: var(--color-fg-muted);
    font-size: 0.85rem;
    margin: 0 0 1.25rem;
  }

  .ad-slot {
    width: 300px;
    height: 250px;
    max-width: 100%;
    margin: 0 auto 1rem;
    background: var(--color-bg-soft);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .ad-label {
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-fg-subtle);
    background: var(--color-bg);
    padding: 0.15rem 0.4rem;
    border-radius: 999px;
    border: 1px solid var(--color-border);
  }

  .close {
    width: 100%;
    height: 44px;
    background: var(--color-fg);
    color: var(--color-bg);
    border: 0;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 500;
    transition: background 0.15s, transform 0.15s;
  }
  .close:hover { background: var(--color-accent); }
  .close:active { transform: scale(0.99); }
</style>
