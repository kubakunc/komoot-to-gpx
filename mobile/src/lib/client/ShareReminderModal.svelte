<script lang="ts">
  let { onClose }: { onClose: () => void } = $props();

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
  onkeydown={(e) => e.key === 'Enter' && onClose()}
  role="dialog"
  aria-modal="true"
  aria-labelledby="share-reminder-title"
  tabindex="-1"
>
  <div class="card">
    <div class="icon" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="12" r="2.6" stroke="var(--color-fg)" stroke-width="1.6" />
        <circle cx="17" cy="5.5" r="2.6" stroke="var(--color-fg)" stroke-width="1.6" />
        <circle cx="17" cy="18.5" r="2.6" stroke="var(--color-fg)" stroke-width="1.6" />
        <path d="M8.3 10.8 L14.7 6.9 M8.3 13.2 L14.7 17.1" stroke="var(--color-fg)" stroke-width="1.6" />
      </svg>
    </div>

    <h2 id="share-reminder-title">Did you know?</h2>
    <p class="text">
      In the Komoot app, open any tour and tap
      <strong>Share</strong> → <strong>Export GPX</strong>.
      The tour opens right here, ready to save as GPX.
    </p>

    <button class="close" onclick={onClose}>Got it</button>
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

  .icon { display: flex; justify-content: center; margin-bottom: 0.5rem; }

  h2 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }

  .text {
    color: var(--color-fg-muted);
    font-size: 0.9rem;
    line-height: 1.55;
    margin: 0.6rem 0 1.5rem;
  }
  .text strong { color: var(--color-fg); font-weight: 600; }

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
