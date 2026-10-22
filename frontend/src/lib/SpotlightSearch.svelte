<script lang="ts">
  import { searchQuery, isSearching, searchError, rawResults, isFilterSheetOpen, filterState, showToast, authToken, safeSearch } from './stores';
  import type { SearchResultItem } from '../types';

  let inputEl: HTMLInputElement;

  async function handleSearch() {
    const query = $searchQuery.trim();
    if (!query) return;

    isSearching.set(true);
    searchError.set(null);

    try {
      const headers: Record<string, string> = {};
      if ($authToken) {
        headers['Authorization'] = `Bearer ${$authToken}`;
      }
      const safeParam = $safeSearch ? '1' : '0';
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&safe=${safeParam}`, { headers });
      const data = await res.json();

      if (!res.ok || !data.results || data.results.length === 0) {
        rawResults.set([]);
        searchError.set(data.error || `No results returned for '${query}'.`);
      } else {
        rawResults.set(data.results as SearchResultItem[]);
      }
    } catch (err: any) {
      searchError.set(`Network error: ${err.message}`);
      showToast(`Search failed: ${err.message}`, 'error');
    } finally {
      isSearching.set(false);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  function clearSearch() {
    searchQuery.set('');
    rawResults.set([]);
    searchError.set(null);
    if (inputEl) inputEl.focus();
  }

  function toggleFilterSheet() {
    isFilterSheetOpen.update(v => !v);
  }

  $: activeFilterCount = $filterState.qualities.length + $filterState.sizes.length + $filterState.providers.length + ($filterState.sortOption !== 'availability' ? 1 : 0);
</script>

<div class="search-stage">
  <div class="search-lede">
    <h1>Find torrents across <span class="accent">six indexers</span> at once.</h1>
    <p>Search a title and pick the magnet you want — copy it into any torrent client.</p>
  </div>

  <div class="search-pill" class:focused={$isSearching}>
    <div class="search-leading">
      {#if $isSearching}
        <div class="spinner"></div>
      {:else}
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
        </svg>
      {/if}
    </div>

    <input
      bind:this={inputEl}
      type="text"
      class="search-input"
      placeholder="Search movies, shows, software…"
      bind:value={$searchQuery}
      on:keydown={handleKeydown}
      disabled={$isSearching}
      autocomplete="off"
      spellcheck="false"
    />

    <div class="search-trailing">
      {#if $searchQuery}
        <button class="icon-action" on:click={clearSearch} aria-label="Clear search">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      {/if}

      <button
        class="filter-action"
        class:has-filters={activeFilterCount > 0}
        on:click={toggleFilterSheet}
        title="Filter and sort"
        aria-label="Open filters"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clip-rule="evenodd" />
        </svg>
        {#if activeFilterCount > 0}
          <span class="filter-dot">{activeFilterCount}</span>
        {/if}
      </button>

      <button class="submit" on:click={handleSearch} disabled={$isSearching || !$searchQuery.trim()}>
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" />
        </svg>
        <span>Search</span>
      </button>
    </div>
  </div>
</div>

<style>
  .search-stage {
    max-width: 880px;
    margin: 3rem auto 1.5rem;
    padding: 0 1.5rem;
    text-align: center;
  }

  .search-lede {
    margin-bottom: 2rem;
  }

  .search-lede h1 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.4rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: #F5F5F7;
  }

  .search-lede h1 .accent {
    background: linear-gradient(90deg, #0A84FF, #5E5CE6);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .search-lede p {
    margin: 0.75rem 0 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 1rem;
  }

  .search-pill {
    display: flex;
    align-items: center;
    background: rgba(28, 28, 32, 0.75);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 0.45rem 0.55rem 0.45rem 1.1rem;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .search-pill.focused {
    border-color: rgba(10, 132, 255, 0.6);
    box-shadow: 0 14px 44px rgba(0, 0, 0, 0.45), 0 0 0 3px rgba(10, 132, 255, 0.22);
  }

  .search-leading {
    display: inline-flex;
    color: rgba(255, 255, 255, 0.45);
    margin-right: 0.9rem;
  }

  .search-leading svg {
    width: 20px;
    height: 20px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-top-color: #0A84FF;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #F5F5F7;
    font-size: 1.05rem;
    font-family: inherit;
    font-weight: 400;
    letter-spacing: -0.01em;
    min-width: 0;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  .search-trailing {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .icon-action {
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .icon-action svg { width: 14px; height: 14px; }

  .icon-action:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.08);
  }

  .filter-action {
    position: relative;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .filter-action svg { width: 15px; height: 15px; }

  .filter-action:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.1);
  }

  .filter-action.has-filters {
    color: #64D2FF;
    border-color: rgba(10, 132, 255, 0.4);
    background: rgba(10, 132, 255, 0.12);
  }

  .filter-dot {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #0A84FF;
    color: #FFFFFF;
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 8px;
    box-shadow: 0 0 0 2px rgba(28, 28, 32, 0.95);
  }

  .submit {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: linear-gradient(135deg, #0A84FF, #5E5CE6);
    border: none;
    color: #FFFFFF;
    padding: 0.55rem 1.05rem;
    border-radius: 11px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(10, 132, 255, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .submit svg { width: 14px; height: 14px; }

  .submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgba(10, 132, 255, 0.45);
  }

  .submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .submit span { display: none; }
    .submit { padding: 0.55rem 0.75rem; }
  }
</style>
