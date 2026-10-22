<script lang="ts">
  import type { IndexerInfo } from '../types';
  import { authRequired, isAuthenticated, safeSearch, logoutInstance } from './stores';

  const indexers: IndexerInfo[] = [
    { short: 'SOLID', name: 'SolidTorrents',  description: 'Direct JSON API · DHT-indexed torrents · prioritized top quality bonus', type: 'api' },
    { short: 'TPB',   name: 'ThePirateBay',   description: 'ApiBay proxy · widest library · category 500-599 adult filtered',    type: 'api' },
    { short: 'YTS',   name: 'YTS.mx',         description: 'REST JSON · Movies only · 720p · 1080p · 4K remux packs',         type: 'api' },
    { short: 'EZTV',  name: 'EZTV',           description: 'REST JSON · TV Shows and episode packs with verified magnets',     type: 'api' },
    { short: '1337X', name: '1337x',          description: 'HTML scrape · wide library · magnet resolved from detail pages',  type: 'scrape' },
    { short: 'TGX',   name: 'TorrentGalaxy',  description: 'HTML scrape · multi-audio releases · scene + verified uploads',    type: 'scrape' }
  ];
</script>

<div class="indexers-container">
  <div class="indexers-header">
    <h2 class="indexers-title">Instance Settings & Indexers</h2>
    <p class="indexers-subtitle">Manage single-user instance security, content filters, and parallel provider feeds.</p>
  </div>

  <!-- Security & Content Controls -->
  <section class="controls-grid">
    <div class="control-card">
      <div class="control-head">
        <div class="control-icon-box shield">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 1.5a.75.75 0 01.556.247c1.398 1.488 3.09 2.253 4.887 2.253a.75.75 0 01.75.75c0 5.424-2.81 9.948-5.88 12.046a.75.75 0 01-.826 0C6.41 14.698 3.6 10.174 3.6 4.75a.75.75 0 01.75-.75c1.797 0 3.49-.765 4.887-2.253A.75.75 0 0110 1.5z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 class="control-title">18+ Adult Content Filter</h3>
          <p class="control-desc">Drop explicit torrents, porn studios, and NSFW categories automatically.</p>
        </div>
      </div>
      <div class="control-action">
        <label class="switch">
          <input type="checkbox" bind:checked={$safeSearch} />
          <span class="slider"></span>
        </label>
        <span class="status-tag" class:active={$safeSearch}>
          {$safeSearch ? 'Active (Default)' : 'Disabled'}
        </span>
      </div>
    </div>

    <div class="control-card">
      <div class="control-head">
        <div class="control-icon-box lock">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 class="control-title">Instance Protection</h3>
          <p class="control-desc">
            {#if $authRequired}
              Protected by master password (configured in environment).
            {:else}
              Open mode (set JELLYPULL_PASSWORD to enforce personal password).
            {/if}
          </p>
        </div>
      </div>
      <div class="control-action">
        {#if $authRequired && $isAuthenticated}
          <button class="lock-btn-action" on:click={logoutInstance}>Lock Instance</button>
        {:else if $authRequired}
          <span class="status-tag locked">Locked</span>
        {:else}
          <span class="status-tag open">LAN / Open</span>
        {/if}
      </div>
    </div>
  </section>

  <!-- Aggregated Indexers Grid -->
  <div class="section-title-wrap">
    <h3>Live Indexer Microservices</h3>
    <p>Concurrent queries fan-out simultaneously with SolidTorrents prioritized by default.</p>
  </div>

  <div class="indexer-grid">
    {#each indexers as idx (idx.short)}
      <article class="indexer-card">
        <header class="indexer-card-head">
          <span class="indexer-badge badge-{idx.short.toLowerCase()}">{idx.short}</span>
          <span class="indexer-mode">{idx.type === 'api' ? 'API' : 'Scrape'}</span>
        </header>
        <h4 class="indexer-name">{idx.name}</h4>
        <p class="indexer-desc">{idx.description}</p>
      </article>
    {/each}
  </div>

  <!-- Deploy Instructions for Friends -->
  <section class="info-card">
    <div class="deploy-banner">
      <div>
        <h3>Deploying for Friends & Homelabs</h3>
        <p class="deploy-sub">Friends can self-host their own single-user Jellypull container in under 60 seconds with Docker Compose:</p>
      </div>
      <div class="code-pill">
        <code>docker compose up -d</code>
      </div>
    </div>
    <ul class="deploy-points">
      <li><strong>Isolated Microservices:</strong> Scraper backend runs strictly on the internal Docker network. Only the Web UI is exposed.</li>
      <li><strong>In-Memory Fast Cache:</strong> Queries are cached for 5 minutes to eliminate redundant upstream indexer requests.</li>
      <li><strong>Zero External Tracking:</strong> Live feeds only; zero database tracking or user data storage.</li>
    </ul>
  </section>
</div>

<style>
  .indexers-container {
    max-width: 1080px;
    margin: 2rem auto 4rem;
    padding: 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .indexers-header {
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .indexers-title {
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #F5F5F7;
    margin: 0;
  }

  .indexers-subtitle {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0.4rem 0 0;
  }

  .controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1rem;
  }

  .control-card {
    background: linear-gradient(135deg, rgba(28, 28, 32, 0.9), rgba(20, 20, 24, 0.9));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1.25rem;
  }

  .control-head {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
  }

  .control-icon-box {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .control-icon-box svg {
    width: 20px;
    height: 20px;
  }

  .control-icon-box.shield {
    background: rgba(48, 209, 88, 0.15);
    color: #30D158;
    border: 1px solid rgba(48, 209, 88, 0.3);
  }

  .control-icon-box.lock {
    background: rgba(10, 132, 255, 0.15);
    color: #64D2FF;
    border: 1px solid rgba(10, 132, 255, 0.3);
  }

  .control-title {
    font-size: 0.98rem;
    font-weight: 700;
    color: #F5F5F7;
    margin: 0 0 0.25rem;
  }

  .control-desc {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.4;
  }

  .control-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .status-tag {
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.6);
  }

  .status-tag.active {
    background: rgba(48, 209, 88, 0.15);
    color: #30D158;
    border: 1px solid rgba(48, 209, 88, 0.3);
  }

  .status-tag.locked {
    background: rgba(255, 69, 58, 0.15);
    color: #FF453A;
  }

  .status-tag.open {
    background: rgba(10, 132, 255, 0.15);
    color: #64D2FF;
  }

  .lock-btn-action {
    background: rgba(255, 69, 58, 0.12);
    border: 1px solid rgba(255, 69, 58, 0.3);
    color: #FF453A;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lock-btn-action:hover {
    background: rgba(255, 69, 58, 0.25);
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.2);
    transition: 0.2s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #30D158;
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  .section-title-wrap {
    margin-top: 0.5rem;
  }

  .section-title-wrap h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #F5F5F7;
    margin: 0;
  }

  .section-title-wrap p {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0.3rem 0 0;
  }

  .indexer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .indexer-card {
    background: linear-gradient(135deg, rgba(28, 28, 32, 0.85), rgba(20, 20, 24, 0.85));
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    transition: transform 0.18s ease, border-color 0.18s ease;
  }

  .indexer-card:hover {
    transform: translateY(-2px);
    border-color: rgba(10, 132, 255, 0.35);
  }

  .indexer-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .indexer-badge {
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    letter-spacing: 0.06em;
  }

  .badge-solid { background: rgba(10, 132, 255, 0.2); color: #64D2FF; border: 1px solid rgba(10, 132, 255, 0.4); }
  .badge-tpb   { background: rgba(255, 159, 10, 0.2); color: #FF9F0A; border: 1px solid rgba(255, 159, 10, 0.4); }
  .badge-yts   { background: rgba(48, 209, 88, 0.2); color: #30D158; border: 1px solid rgba(48, 209, 88, 0.4); }
  .badge-eztv  { background: rgba(191, 90, 242, 0.2); color: #BF5AF2; border: 1px solid rgba(191, 90, 242, 0.4); }
  .badge-1337x { background: rgba(255, 69, 58, 0.2); color: #FF453A; border: 1px solid rgba(255, 69, 58, 0.4); }
  .badge-tgx   { background: rgba(255, 55, 95, 0.2); color: #FF375F; border: 1px solid rgba(255, 55, 95, 0.4); }

  .indexer-mode {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 700;
  }

  .indexer-name {
    font-size: 1.05rem;
    font-weight: 700;
    color: #F5F5F7;
    margin: 0;
  }

  .indexer-desc {
    font-size: 0.8rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.55);
    margin: 0;
  }

  .info-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 1.4rem 1.6rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .deploy-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .deploy-banner h3 {
    font-size: 1rem;
    font-weight: 700;
    color: #F5F5F7;
    margin: 0 0 0.3rem;
  }

  .deploy-sub {
    font-size: 0.84rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .code-pill {
    background: rgba(10, 132, 255, 0.15);
    border: 1px solid rgba(10, 132, 255, 0.3);
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    color: #64D2FF;
    font-family: monospace;
    font-size: 0.88rem;
  }

  .deploy-points {
    margin: 0;
    padding-left: 1.2rem;
    color: rgba(255, 255, 255, 0.65);
    font-size: 0.86rem;
    line-height: 1.6;
  }

  .deploy-points li {
    margin-bottom: 0.35rem;
  }

  .deploy-points strong {
    color: #F5F5F7;
  }
</style>
