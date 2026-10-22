<script lang="ts">
  import {
    groupedResults,
    isSearching,
    searchError,
    rawResults,
    expandedProviders,
    showToast
  } from './stores';
  import { copyToClipboard } from './clipboard';
  import type { SearchResultItem } from '../types';

  let copiedStates: Record<string, boolean> = {};

  async function handleCopy(item: SearchResultItem, e: MouseEvent) {
    e.stopPropagation();
    const success = await copyToClipboard(item.magnet_link);
    if (success) {
      copiedStates[item.magnet_link] = true;
      copiedStates = { ...copiedStates };
      showToast('Magnet link copied to clipboard', 'success');
      setTimeout(() => {
        copiedStates[item.magnet_link] = false;
        copiedStates = { ...copiedStates };
      }, 2000);
    } else {
      showToast('Failed to copy magnet link', 'error');
    }
  }

  function toggleProvider(name: string, hasResults: boolean) {
    if (!hasResults) return;
    expandedProviders.update(set => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function expandAll() {
    expandedProviders.set(new Set($groupedResults.map(g => g.providerName)));
  }

  function collapseAll() {
    expandedProviders.set(new Set());
  }

  function getBadgeClass(short: string): string {
    const s = (short || '').toUpperCase();
    if (s === 'SOLID') return 'badge-solid';
    if (s === 'TPB') return 'badge-tpb';
    if (s === 'YTS') return 'badge-yts';
    if (s === 'EZTV') return 'badge-eztv';
    if (s === '1337X') return 'badge-1337x';
    if (s === 'TGX') return 'badge-tgx';
    return 'badge-default';
  }

  $: hasResults = $rawResults && $rawResults.length > 0;
  $: visibleProviders = $groupedResults.filter(g => g.items.length > 0);
  $: emptyProviders = $groupedResults.filter(g => g.items.length === 0);
</script>

<div class="results-wrap">
  {#if $isSearching}
    <div class="loading-card">
      <div class="dot-row">
        <span></span><span></span><span></span>
      </div>
      <p>Querying live indexers…</p>
    </div>
  {:else if $searchError}
    <div class="notice-card">
      <div class="notice-icon">⚠️</div>
      <h3>Nothing came back</h3>
      <p>{$searchError}</p>
    </div>
  {:else if $groupedResults.length === 0}
    <div class="welcome-card">
      <div class="welcome-glyph">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <h2>Find the right release in seconds</h2>
      <p>Search a title — results flow in from SolidTorrents, ThePirateBay, YTS, EZTV, 1337x, and TorrentGalaxy simultaneously.</p>
    </div>
  {:else}
    <div class="results-toolbar">
      <span class="results-count">
        {$rawResults.length} { $rawResults.length === 1 ? 'result' : 'results' } across {visibleProviders.length} indexers
      </span>
      <div class="toolbar-actions">
        <button on:click={expandAll}>Expand all</button>
        <span class="dot-sep"></span>
        <button on:click={collapseAll}>Collapse all</button>
      </div>
    </div>

    <div class="accordion-list">
      {#each visibleProviders as group (group.providerName)}
        {@const isOpen = $expandedProviders.has(group.providerName)}
        <section class="accordion-item" class:open={isOpen}>
          <button
            class="accordion-trigger"
            on:click={() => toggleProvider(group.providerName, true)}
            aria-expanded={isOpen}
          >
            <div class="trigger-left">
              <span class="provider-badge {getBadgeClass(group.providerShort)}">{group.providerShort}</span>
              <h3 class="provider-name">{group.providerName}</h3>
            </div>
            <div class="trigger-right">
              <span class="provider-count">{group.items.length}</span>
              <svg class="chevron" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </div>
          </button>

          {#if isOpen}
            <div class="accordion-panel">
              <table class="result-table">
                <thead>
                  <tr>
                    <th class="col-title">Title</th>
                    <th class="col-size">Size</th>
                    <th class="col-num">Seeds</th>
                    <th class="col-num">Leech</th>
                    <th class="col-act"></th>
                  </tr>
                </thead>
                <tbody>
                  {#each group.items as item (item.magnet_link + item.title)}
                    <tr class="result-row">
                      <td class="cell-title">
                        <span class="title-text" title={item.title}>{item.title}</span>
                      </td>
                      <td class="cell-size">{item.size}</td>
                      <td class="cell-seeders">{item.seeders}</td>
                      <td class="cell-leechers">{item.leechers}</td>
                      <td class="cell-act">
                        <button
                          class="copy-btn"
                          class:copied={copiedStates[item.magnet_link]}
                          on:click={(e) => handleCopy(item, e)}
                          title="Copy magnet URI"
                          aria-label="Copy magnet link"
                        >
                          {#if copiedStates[item.magnet_link]}
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                            </svg>
                            <span>Copied</span>
                          {:else}
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                              <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
                            </svg>
                            <span>Copy</span>
                          {/if}
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </section>
      {/each}

      {#if emptyProviders.length > 0}
        <section class="accordion-item empty">
          <button class="accordion-trigger disabled" disabled>
            <div class="trigger-left">
              <span class="provider-badge {getBadgeClass(emptyProviders[0].providerShort)}">{emptyProviders[0].providerShort}</span>
              <h3 class="provider-name">{emptyProviders[0].providerName}</h3>
            </div>
            <div class="trigger-right">
              <span class="provider-count muted">0 results</span>
            </div>
          </button>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .results-wrap {
    max-width: 1080px;
    margin: 1rem auto 4rem;
    padding: 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ----- empty / loading ----- */
  .welcome-card, .loading-card, .notice-card {
    text-align: center;
    padding: 4.5rem 1.5rem;
    background: rgba(26, 26, 30, 0.55);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 22px;
    color: rgba(255, 255, 255, 0.55);
  }

  .welcome-glyph {
    width: 64px;
    height: 64px;
    margin: 0 auto 1.25rem;
    color: rgba(10, 132, 255, 0.45);
  }

  .welcome-card h2, .notice-card h3 {
    color: #F5F5F7;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 0.5rem;
  }

  .welcome-card h2 { font-size: 1.5rem; }
  .notice-card h3 { font-size: 1.2rem; }

  .welcome-card p, .notice-card p {
    max-width: 480px;
    margin: 0 auto;
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .notice-icon {
    font-size: 2.4rem;
    margin-bottom: 0.5rem;
  }

  .dot-row {
    display: inline-flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .dot-row span {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #0A84FF;
    animation: pulse 1.4s infinite ease-in-out both;
  }

  .dot-row span:nth-child(2) { animation-delay: -0.16s; }
  .dot-row span:nth-child(3) { animation-delay: -0.32s; }

  @keyframes pulse {
    0%, 80%, 100% { transform: scale(0.55); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* ----- toolbar ----- */
  .results-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.25rem;
  }

  .results-count {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }

  .toolbar-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
  }

  .toolbar-actions button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.55);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .toolbar-actions button:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.06);
  }

  .dot-sep {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
  }

  /* ----- accordion ----- */
  .accordion-list {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .accordion-item {
    background: linear-gradient(180deg, rgba(26, 26, 30, 0.78), rgba(22, 22, 26, 0.78));
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .accordion-item.open {
    border-color: rgba(10, 132, 255, 0.25);
  }

  .accordion-item.empty {
    opacity: 0.55;
  }

  .accordion-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: transparent;
    border: none;
    padding: 1rem 1.25rem;
    color: #F5F5F7;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .accordion-trigger:not(.disabled):hover {
    background: rgba(255, 255, 255, 0.025);
  }

  .accordion-trigger.disabled { cursor: not-allowed; }

  .trigger-left {
    display: inline-flex;
    align-items: center;
    gap: 0.85rem;
  }

  .trigger-right {
    display: inline-flex;
    align-items: center;
    gap: 0.85rem;
  }

  .provider-badge {
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0.22rem 0.55rem;
    border-radius: 6px;
    letter-spacing: 0.06em;
    min-width: 56px;
    text-align: center;
  }

  .badge-solid  { background: rgba(10, 132, 255, 0.2); color: #64D2FF; border: 1px solid rgba(10, 132, 255, 0.4); }
  .badge-tpb    { background: rgba(255, 159, 10, 0.2); color: #FF9F0A; border: 1px solid rgba(255, 159, 10, 0.4); }
  .badge-yts    { background: rgba(48, 209, 88, 0.2); color: #30D158; border: 1px solid rgba(48, 209, 88, 0.4); }
  .badge-eztv   { background: rgba(191, 90, 242, 0.2); color: #BF5AF2; border: 1px solid rgba(191, 90, 242, 0.4); }
  .badge-1337x  { background: rgba(255, 69, 58, 0.2); color: #FF453A; border: 1px solid rgba(255, 69, 58, 0.4); }
  .badge-tgx    { background: rgba(255, 55, 95, 0.2); color: #FF375F; border: 1px solid rgba(255, 55, 95, 0.4); }
  .badge-default{ background: rgba(255, 255, 255, 0.1); color: #FFFFFF; border: 1px solid rgba(255, 255, 255, 0.15); }

  .provider-name {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 600;
    color: #F5F5F7;
    letter-spacing: -0.01em;
  }

  .provider-count {
    background: rgba(10, 132, 255, 0.15);
    border: 1px solid rgba(10, 132, 255, 0.35);
    color: #64D2FF;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }

  .provider-count.muted {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.45);
  }

  .chevron {
    width: 18px;
    height: 18px;
    color: rgba(255, 255, 255, 0.4);
    transition: transform 0.25s ease;
  }

  .accordion-item.open .chevron {
    transform: rotate(180deg);
    color: #64D2FF;
  }

  /* ----- panel ----- */
  .accordion-panel {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.4rem 0.5rem 0.6rem;
    animation: drop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes drop {
    from { transform: translateY(-4px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .result-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    table-layout: fixed;
  }

  .result-table th {
    text-align: left;
    padding: 0.55rem 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.4);
  }

  .col-title { width: 50%; }
  .col-size  { width: 12%; }
  .col-num   { width: 10%; text-align: right; }
  .col-act   { width: 18%; text-align: right; }

  .result-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s ease;
  }

  .result-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .result-row td {
    padding: 0.65rem 0.75rem;
    vertical-align: middle;
  }

  .title-text {
    display: block;
    color: #F5F5F7;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cell-size {
    color: rgba(255, 255, 255, 0.75);
    font-variant-numeric: tabular-nums;
  }

  .cell-seeders {
    color: #30D158;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .cell-leechers {
    color: #FF453A;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .cell-act {
    text-align: right;
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn svg {
    width: 13px;
    height: 13px;
  }

  .copy-btn:hover {
    background: rgba(10, 132, 255, 0.15);
    border-color: rgba(10, 132, 255, 0.45);
    color: #FFFFFF;
  }

  .copy-btn.copied {
    background: rgba(48, 209, 88, 0.18);
    border-color: rgba(48, 209, 88, 0.5);
    color: #30D158;
  }

  @media (max-width: 720px) {
    .col-title { width: 44%; }
    .cell-leechers, .col-leechers { display: none; }
    .copy-btn span { display: none; }
    .copy-btn { padding: 0.4rem; }
  }
</style>
