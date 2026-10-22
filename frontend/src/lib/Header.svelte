<script lang="ts">
  import { activeTab, authRequired, isAuthenticated, logoutInstance, safeSearch } from './stores';
</script>

<header class="app-header">
  <div class="header-inner">
    <button class="brand" on:click={() => activeTab.set('search')} aria-label="Jellypull home">
      <span class="brand-mark">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="brandGrad" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop stop-color="#0A84FF" />
              <stop offset="1" stop-color="#5E5CE6" />
            </linearGradient>
          </defs>
          <path d="M6 15C6 9.477 10.477 5 16 5s10 4.477 10 10c0 3.5-2 5-5 5-1.5 0-2.5-1-4-1s-2.5 1-4 1c-3 0-7-1.5-7-5z" fill="url(#brandGrad)" />
          <path d="M10 20v6c0 1 1 1.5 1.5.5s1-2.5 1.5-2.5 1 1.5 1.5 2.5 1.5.5 1.5-.5v-6M16 20v6c0 1 1 1.5 1.5.5s1-2.5 1.5-2.5 1 1.5 1.5 2.5 1.5.5 1.5-.5v-6" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="13" r="1.5" fill="#FFFFFF" />
          <circle cx="20" cy="13" r="1.5" fill="#FFFFFF" />
        </svg>
      </span>
      <span class="brand-text">Jellypull</span>
    </button>

    <nav class="header-tabs" aria-label="Primary">
      <button
        class="tab-pill"
        class:active={$activeTab === 'search'}
        on:click={() => activeTab.set('search')}
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
        </svg>
        <span>Search</span>
      </button>
      <button
        class="tab-pill"
        class:active={$activeTab === 'indexers'}
        on:click={() => activeTab.set('indexers')}
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 4a1 1 0 011-1h4a1 1 0 011 1v1h2.5a1.5 1.5 0 011.5 1.5v10A1.5 1.5 0 0115.5 18h-11A1.5 1.5 0 013 16.5v-10A1.5 1.5 0 014.5 5H7V4zM5 7v8h10V7H5z" />
        </svg>
        <span>Indexers</span>
      </button>
    </nav>

    <div class="header-actions">
      {#if $safeSearch}
        <div class="safe-badge" title="Safe Search Active (18+ Adult Content Filtered)">
          <span class="safe-dot"></span>
          <span class="safe-label">Safe</span>
        </div>
      {/if}

      {#if $authRequired && $isAuthenticated}
        <button class="lock-btn" on:click={logoutInstance} title="Lock personal instance">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
          </svg>
          <span class="lock-label">Lock</span>
        </button>
      {/if}
    </div>
  </div>
</header>

<style>
  .app-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(13, 13, 15, 0.78);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1.5rem;
    height: 64px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    background: transparent;
    border: none;
    padding: 0.4rem 0.6rem;
    margin-left: -0.6rem;
    border-radius: 12px;
    color: inherit;
    cursor: pointer;
    transition: background 0.15s ease;
    justify-self: start;
  }

  .brand:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(10, 132, 255, 0.18), rgba(94, 92, 230, 0.18));
    box-shadow: 0 0 0 1px rgba(10, 132, 255, 0.25) inset;
  }

  .brand-mark svg {
    width: 22px;
    height: 22px;
  }

  .brand-text {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #F5F5F7;
  }

  .header-tabs {
    display: inline-flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.07);
    padding: 4px;
    border-radius: 14px;
    gap: 2px;
    justify-self: center;
  }

  .tab-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.86rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tab-pill svg {
    width: 15px;
    height: 15px;
  }

  .tab-pill:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-pill.active {
    background: rgba(255, 255, 255, 0.12);
    color: #FFFFFF;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .header-actions {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .safe-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    background: rgba(48, 209, 88, 0.12);
    border: 1px solid rgba(48, 209, 88, 0.25);
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #30D158;
  }

  .safe-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #30D158;
    box-shadow: 0 0 6px #30D158;
  }

  .lock-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.8rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lock-btn svg {
    width: 14px;
    height: 14px;
  }

  .lock-btn:hover {
    background: rgba(255, 69, 58, 0.12);
    border-color: rgba(255, 69, 58, 0.3);
    color: #FF453A;
  }

  @media (max-width: 640px) {
    .brand-text { display: none; }
    .tab-pill span { display: none; }
    .tab-pill { padding: 0.5rem 0.65rem; }
    .lock-label { display: none; }
  }
</style>
