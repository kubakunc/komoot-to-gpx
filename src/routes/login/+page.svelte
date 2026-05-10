<script lang="ts">
  import { goto } from '$app/navigation';
  import { setSession } from '$lib/client/session';

  let email = $state('');
  let password = $state('');
  let errorMsg = $state<string | null>(null);
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    errorMsg = null;
    busy = true;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 401) {
        errorMsg = 'Nieprawidłowy email lub hasło.';
        return;
      }
      if (res.status === 429) {
        errorMsg = 'Zbyt wiele prób. Spróbuj za chwilę.';
        return;
      }
      if (!res.ok) {
        errorMsg = 'Komoot nie odpowiada. Spróbuj ponownie.';
        return;
      }
      const data = (await res.json()) as { userId: string; token: string };
      setSession({ email, userId: data.userId, token: data.token });
      await goto('/', { replaceState: true });
    } catch {
      errorMsg = 'Brak połączenia.';
    } finally {
      busy = false;
    }
  }
</script>

<h1>Zaloguj się do Komoota</h1>

<form onsubmit={submit}>
  <label>
    email
    <input type="email" bind:value={email} required autocomplete="username" />
  </label>
  <label>
    hasło
    <input type="password" bind:value={password} required autocomplete="current-password" />
  </label>
  {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
  <button type="submit" disabled={busy}>{busy ? 'logowanie…' : 'zaloguj'}</button>
</form>

<p class="note">
  Hasło używamy tylko raz — do pobrania tokenu Komoota. Jest trzymane wyłącznie w pamięci podczas żądania.
</p>

<style>
  form { display: grid; gap: 0.75rem; max-width: 360px; }
  label { display: grid; gap: 0.25rem; }
  input { padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; font: inherit; }
  button { padding: 0.6rem 1rem; background: var(--color-accent); color: white; border: 0; border-radius: 4px; }
  button:disabled { opacity: 0.5; }
  .error { color: var(--color-error); margin: 0; }
  .note { color: #666; font-size: 0.85rem; margin-top: 1.5rem; }
</style>
