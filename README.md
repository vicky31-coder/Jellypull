# Jellypull 🪼

> **Fast, private, and beautifully unified torrent indexer designed for self-hosters and Jellyfin enthusiasts.**

Jellypull queries six public torrent indexers concurrently, automatically prioritizing verified releases and high-availability seeds, with built-in master password security and strict Safe Search (18+ content restriction) by default.

---

## ✨ Features

- **⚡ Concurrent Aggregation**: Fans out queries in parallel across **SolidTorrents**, **ThePirateBay (ApiBay)**, **YTS**, **EZTV**, **1337x**, and **TorrentGalaxy**.
- **💎 SolidTorrents Priority**: Automatically applies quality scoring boosts to SolidTorrents DHT results.
- **🔞 Safe Search by Default**: Strictly blocks explicit adult content, porn studio titles, and 18+ indexer categories out of the box.
- **🔒 Single-Account Protection**: Optional master password (`JELLYPULL_PASSWORD`) locks your instance with an Apple-style unlock modal, secure session cookies, and API protection.
- **⚡ Hot Query Cache**: 5-minute in-memory caching provides instant (<1ms) responses on repeated queries without triggering upstream IP limits.
- **🍏 Apple-Inspired UI**: Built with Svelte 5 and TypeScript, featuring spotlight search, slide-over filters, and instant magnet copy feedback.
- **🛡️ Isolated Microservice Architecture**: The scraper backend stays isolated inside the internal Docker network and is never exposed to the public internet.

---

## 🚀 Quick Start (For Friends & Homelabs)

You don't need Rust or Node.js installed. Just Docker and Docker Compose.

### 1. Download Docker Compose

Create a directory on your server or NAS and download `docker-compose.yml`:

```bash
mkdir jellypull && cd jellypull
curl -sO https://raw.githubusercontent.com/vicky31-coder/Jellypull/main/docker-compose.yml
curl -sO https://raw.githubusercontent.com/vicky31-coder/Jellypull/main/.env.example
cp .env.example .env
```

### 2. Configure Environment (`.env`)

Edit `.env` with your desired master password and port:

```env
# Master password to lock your personal instance (leave empty for open LAN mode)
JELLYPULL_PASSWORD=choose_your_password_here

# Port to access the web interface (default: 8045)
PORT=8045

# Enforce Safe Search by default (1 = enabled, 0 = disabled)
SAFE_SEARCH=1
```

### 3. Launch

```bash
docker compose up -d
```

Open your browser at **`http://localhost:8045`** (or your server's IP).

---

## 🛠️ Configuration Reference

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `JELLYPULL_PASSWORD` | *(empty)* | If set, requires this master password to access the UI and API. |
| `PORT` | `8045` | Port mapped on your host machine. |
| `SAFE_SEARCH` | `1` | Enables 18+/NSFW content filtering by default (1 = ON, 0 = OFF). |
| `SCRAPER_URL` | `http://jellypull-scraper:8046` | Internal Docker address of the scraper microservice. |

---

## 🏗️ Architecture

```
Internet / User
      │
      ▼ (Port 8045)
┌─────────────────────────────────┐
│     jellypull-web (Axum)        │
│  - Single-file embedded Svelte  │
│  - Master password auth check   │
│  - In-memory 5-min hot cache    │
└────────────────┬────────────────┘
                 │ Internal Docker Network (Not exposed)
                 ▼
┌─────────────────────────────────┐
│   jellypull-scraper (Tokio)     │
│  - Concurrent 6-indexer fanout │
│  - Category 500-599 TPB filter  │
│  - Smart title NSFW filter      │
│  - SolidTorrents +10k boost     │
└─────────────────────────────────┘
```

---

## 📄 License

MIT License. Free and open source.
