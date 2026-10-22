# Jellypull

Jellypull is a high-performance, privacy-focused media torrent aggregator engineered for personal media servers, home laboratories, and Jellyfin ecosystems.

It consolidates queries across multiple distributed indexers concurrently, evaluates release quality through a deterministic scoring heuristic, and presents results through an interface designed around clarity, precision, and speed.

---

## Overview

Public media indexing is traditionally fragmented across disparate web scrapers, unstable ad-injected interfaces, and inconsistent data formats. Jellypull decouples user interaction from upstream indexers by introducing an isolated, asynchronous gateway layer.

Searches execute concurrently across six major providers, with automatic deduplication by InfoHash and prioritized weighting for high-integrity DHT sources like SolidTorrents. Safe Search is strictly enforced at both category and lexical levels by default.

---

## Architectural Highlights

### Concurrent Query Aggregation
Queries fan out simultaneously using non-blocking asynchronous Tokio tasks across SolidTorrents, The Pirate Bay (ApiBay), YTS, EZTV, 1337x, and TorrentGalaxy. Each provider task operates with a bounded timeout to ensure slow or unresponsive indexers never degrade overall response latency.

### Deterministic Quality Scoring
Results are systematically ranked based on seeder availability, codec profiles, and audio/video release standards. SolidTorrents feeds receive structural priority, followed by high-definition tiers (UHD, 2160p, Blu-ray REMUX, 1080p, WEB-DL).

### Content Restriction by Default
Safe Search is enabled by default to prevent explicit material from appearing in general queries. The system enforces multi-tier filtering:
- Category exclusion: Dropping adult and explicit classifications (including ApiBay categories 500 through 599).
- Lexical heuristic: Word-boundary evaluation stripping pornographic labels, production studios, and adult keywords without false positives on standard titles.

### Single-Instance Access Security
Designed for single-operator homelab deployment. An optional master access passphrase (`JELLYPULL_PASSWORD`) secures the application layer and API endpoints with authenticated session cookies and Bearer tokens.

### In-Memory Hot Query Caching
Repeated queries are fulfilled from an in-memory cache with a 5-minute time-to-live. This minimizes redundant external network requests and mitigates IP-level rate limiting from upstream indexers.

### Decoupled Service Boundary
The scraper engine operates strictly within an isolated internal bridge network, remaining completely inaccessible from the host network or public internet. Only the web gateway service exposes a configurable port.

---

## Quick Start

Jellypull is distributed as a lightweight container image for container runtimes supporting Docker Compose.

### 1. Retrieve the Configuration Files

```bash
mkdir -p jellypull && cd jellypull
curl -fsSL https://raw.githubusercontent.com/vicky31-coder/Jellypull/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/vicky31-coder/Jellypull/main/.env.example -o .env
```

### 2. Configure Environment

Edit `.env` to define your instance port and master password:

```env
# Master passphrase to lock your personal instance (leave empty for open LAN mode)
JELLYPULL_PASSWORD=your_secure_passphrase

# Port exposed on the host system
PORT=8045

# Enforce Safe Search by default (1 = enabled, 0 = disabled)
SAFE_SEARCH=1
```

### 3. Start the Services

```bash
docker compose up -d
```

Access the interface at `http://localhost:8045` (or your server's local IP address).

---

## System Architecture

```
[ Client Interface / API Consumer ]
                 │
                 ▼  Port 8045 (Configurable)
┌───────────────────────────────────────────────┐
│              jellypull-web                    │
│  - Embedded Single-Page Application (Svelte)  │
│  - Master Passphrase Authentication Guard     │
│  - In-Memory Hot Cache (5-Minute TTL)         │
│  - Gzip / Brotli Payload Compression          │
└───────────────────────┬───────────────────────┘
                        │
                        │ Internal Docker Network (jellypull-internal)
                        ▼
┌───────────────────────────────────────────────┐
│            jellypull-scraper                  │
│  - Asynchronous Tokio Task Fan-Out            │
│  - Providers: Solid, TPB, YTS, EZTV, 1337X, TGX│
│  - Multi-Tier Category & Keyword Filtering    │
│  - SolidTorrents Heuristic Priority (+10,000) │
└───────────────────────────────────────────────┘
```

---

## Configuration Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `JELLYPULL_PASSWORD` | String | *(None)* | Master access passphrase. When specified, locks all UI views and API routes behind authentication. |
| `PORT` | Integer | `8045` | TCP port published by the web gateway container. |
| `SAFE_SEARCH` | Integer | `1` | Enforces adult and explicit category filtering (1 = Active, 0 = Inactive). |
| `SCRAPER_URL` | URL | `http://jellypull-scraper:8046` | Internal network endpoint of the upstream scraper microservice. |
| `RUST_LOG` | String | `info` | Logging verbosity filter (`error`, `warn`, `info`, `debug`, `trace`). |

---

## Building from Source

### Prerequisites
- Rust 1.75 or higher
- Node.js 18 or higher
- npm 9 or higher

### Build Steps

1. **Compile the Frontend Bundle**:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. **Compile the Binary**:
   ```bash
   cargo build --release
   ```

3. **Execute**:
   ```bash
   # Run the web daemon
   ./target/release/jellypull serve --port 8045

   # Run the standalone scraper service
   ./target/release/jellypull scraper --port 8046
   ```

---

## Security Considerations

- **Network Isolation**: Always keep `jellypull-scraper` confined to internal container networking. It should never be directly reachable via reverse proxies or external routing rules.
- **TLS Termination**: For remote access over public networks, place Jellypull behind a reverse proxy (such as Caddy, Nginx, or Cloudflare Tunnel) configured for TLS termination.
- **Safe Search Integrity**: The Safe Search policy defaults to active on initial installation to prevent incidental exposure to explicit content.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
