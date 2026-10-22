use crate::config::ProvidersConfig;
use crate::error::{JellypullError, Result};
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::time::timeout;
use url::form_urlencoded;

fn encode_url(s: &str) -> String {
    form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub title: String,
    pub magnet_link: String,
    pub size: String,
    pub seeders: u32,
    pub leechers: u32,
    pub provider_name: String,
    pub provider_short: String,
    pub score: u32,
}

#[derive(Clone)]
pub struct TorrentScraper {
    client: Client,
    user_agent: String,
}

#[derive(Deserialize)]
struct YtsResponse {
    data: Option<YtsData>,
}

#[derive(Deserialize)]
struct YtsData {
    movies: Option<Vec<YtsMovie>>,
}

#[derive(Deserialize)]
struct YtsMovie {
    title_long: String,
    torrents: Option<Vec<YtsTorrent>>,
}

#[derive(Deserialize)]
struct YtsTorrent {
    #[allow(dead_code)]
    url: Option<String>,
    hash: Option<String>,
    quality: Option<String>,
    size: Option<String>,
    seeds: Option<u32>,
    peers: Option<u32>,
}

#[derive(Deserialize)]
struct SolidTorrentsResponse {
    results: Option<Vec<SolidItem>>,
}

#[derive(Deserialize)]
struct SolidItem {
    title: Option<String>,
    infohash: Option<String>,
    size: Option<u64>,
    seeders: Option<u32>,
    leechers: Option<u32>,
    category: Option<String>,
}

impl TorrentScraper {
    pub fn new(_config: &ProvidersConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
            .danger_accept_invalid_certs(true)
            .build()?;

        Ok(Self {
            client,
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36".to_string(),
        })
    }

    pub async fn search(&self, query: &str) -> Result<Vec<SearchResultItem>> {
        self.search_fast(query, &[], true).await
    }

    pub async fn search_fast(&self, query: &str, enabled_providers: &[String], safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let cleaned_query = sanitize_query(query);
        let mut results = self.execute_search_pipeline(&cleaned_query, enabled_providers, safe_search).await;

        if results.is_empty() && cleaned_query.contains(' ') {
            let parts: Vec<&str> = cleaned_query.split_whitespace().collect();
            if parts.len() > 1 {
                let main_title = parts[..parts.len() - 1].join(" ");
                if !main_title.is_empty() {
                    results = self.execute_search_pipeline(&main_title, enabled_providers, safe_search).await;
                }
            }
        }

        if results.is_empty() {
            return Err(JellypullError::Provider(format!(
                "No torrent results found for search query '{}'. Try enabling more sources in Settings.",
                query
            )));
        }

        results.dedup_by(|a, b| a.magnet_link == b.magnet_link);
        results.sort_by(|a, b| b.score.cmp(&a.score));

        Ok(results)
    }

    async fn execute_search_pipeline(&self, query: &str, enabled_providers: &[String], safe_search: bool) -> Vec<SearchResultItem> {
        let mut rx = self.search_stream_enabled(query, enabled_providers, safe_search).await;
        let mut results = Vec::new();

        while let Some((_provider, mut provider_results)) = rx.recv().await {
            results.append(&mut provider_results);
        }

        results
    }

    pub async fn search_stream_enabled(&self, query: &str, enabled_providers: &[String], safe_search: bool) -> mpsc::Receiver<(String, Vec<SearchResultItem>)> {
        let (tx, rx) = mpsc::channel(20);
        let query = query.to_string();
        let providers_set: Vec<String> = if enabled_providers.is_empty() {
            vec!["solid".to_string(), "tpb".to_string(), "yts".to_string(), "eztv".to_string(), "1337x".to_string(), "tgx".to_string()]
        } else {
            enabled_providers.to_vec()
        };

        for provider in providers_set {
            let s = self.clone();
            let tx_clone = tx.clone();
            let q = query.clone();

            tokio::spawn(async move {
                let res = match provider.as_str() {
                    "solid" => s.search_solidtorrents(&q, safe_search).await.unwrap_or_default(),
                    "tpb" => s.search_apibay(&q, safe_search).await.unwrap_or_default(),
                    "yts" => s.search_yts(&q, safe_search).await.unwrap_or_default(),
                    "eztv" => s.search_eztv(&q, safe_search).await.unwrap_or_default(),
                    "1337x" => s.scrape_1337x(&q, safe_search).await.unwrap_or_default(),
                    "tgx" => s.scrape_torrentgalaxy(&q, safe_search).await.unwrap_or_default(),
                    _ => Vec::new(),
                };

                let name = match provider.as_str() {
                    "solid" => "SolidTorrents",
                    "tpb" => "ThePirateBay",
                    "yts" => "YTS",
                    "eztv" => "EZTV",
                    "1337x" => "1337x",
                    "tgx" => "TorrentGalaxy",
                    _ => "Indexer",
                };

                let _ = tx_clone.send((name.to_string(), res)).await;
                drop(tx_clone);
            });
        }

        drop(tx);
        rx
    }

    async fn fetch_url(&self, url: &str) -> Result<String> {
        let fetch_future = async {
            if let Ok(res) = self.client.get(url).send().await {
                if res.status().is_success() {
                    if let Ok(text) = res.text().await {
                        if !text.is_empty() {
                            return Ok(text);
                        }
                    }
                }
            }

            let output = Command::new("curl")
                .arg("-s")
                .arg("-L")
                .arg("-m")
                .arg("5")
                .arg("-A")
                .arg(&self.user_agent)
                .arg(url)
                .output()
                .await
                .map_err(|e| JellypullError::Provider(format!("curl error: {}", e)))?;

            if output.status.success() {
                let body = String::from_utf8_lossy(&output.stdout).to_string();
                if !body.is_empty() {
                    return Ok(body);
                }
            }

            Err(JellypullError::Provider(format!("Failed to fetch URL '{}'", url)))
        };

        match timeout(Duration::from_secs(15), fetch_future).await {
            Ok(res) => res,
            Err(_) => Err(JellypullError::Provider(format!("Fetch timeout for URL '{}'", url))),
        }
    }

    pub async fn search_solidtorrents(&self, query: &str, safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let url = format!("https://solidtorrents.to/api/v1/search?q={}", encode_url(query));
        let body_text = self.fetch_url(&url).await?;

        let resp: SolidTorrentsResponse = serde_json::from_str(&body_text)
            .map_err(|e| JellypullError::Provider(format!("SolidTorrents parse error: {}", e)))?;

        let mut results = Vec::new();

        if let Some(items) = resp.results {
            for item in items {
                if let (Some(title), Some(hash)) = (item.title, item.infohash) {
                    if safe_search {
                        if let Some(ref cat) = item.category {
                            let cat_l = cat.to_lowercase();
                            if cat_l.contains("xxx") || cat_l.contains("adult") || cat_l.contains("porn") {
                                continue;
                            }
                        }
                        if is_nsfw_title(&title) {
                            continue;
                        }
                    }

                    let seeders = item.seeders.unwrap_or(0);
                    let leechers = item.leechers.unwrap_or(0);
                    let raw_size = item.size.unwrap_or(0);
                    let formatted_size = format_bytes(raw_size);

                    let magnet = format!(
                        "magnet:?xt=urn:btih:{}&dn={}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce",
                        hash,
                        encode_url(&title)
                    );

                    let score = calculate_quality_score(&title, seeders, "SOLID");

                    results.push(SearchResultItem {
                        title,
                        magnet_link: magnet,
                        size: formatted_size,
                        seeders,
                        leechers,
                        provider_name: "SolidTorrents".to_string(),
                        provider_short: "SOLID".to_string(),
                        score,
                    });
                }
            }
        }

        Ok(results)
    }

    pub async fn search_apibay(&self, query: &str, safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let url = format!("https://apibay.org/q.php?q={}", encode_url(query));
        let body_text = self.fetch_url(&url).await?;

        let items: Vec<Value> = serde_json::from_str(&body_text)
            .map_err(|e| JellypullError::Provider(format!("JSON parse error: {}", e)))?;

        let mut results = Vec::new();

        for item in items {
            let name = match item.get("name").and_then(|v| v.as_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            let info_hash = match item.get("info_hash").and_then(|v| v.as_str()) {
                Some(h) => h.to_string(),
                None => continue,
            };

            if info_hash == "0000000000000000000000000000000000000000" || name == "No results found" {
                continue;
            }

            if safe_search {
                let category_num = item.get("category")
                    .and_then(|v| {
                        if let Some(n) = v.as_u64() {
                            Some(n as u32)
                        } else if let Some(s) = v.as_str() {
                            s.parse::<u32>().ok()
                        } else {
                            None
                        }
                    })
                    .unwrap_or(0);

                if category_num >= 500 && category_num < 600 {
                    continue;
                }
                if is_nsfw_title(&name) {
                    continue;
                }
            }

            let seeders = parse_val_to_u32(item.get("seeders"));
            let leechers = parse_val_to_u32(item.get("leechers"));
            let raw_size = parse_val_to_u64(item.get("size"));
            let formatted_size = format_bytes(raw_size);

            let magnet = format!(
                "magnet:?xt=urn:btih:{}&dn={}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce",
                info_hash,
                encode_url(&name)
            );

            let score = calculate_quality_score(&name, seeders, "TPB");

            results.push(SearchResultItem {
                title: name,
                magnet_link: magnet,
                size: formatted_size,
                seeders,
                leechers,
                provider_name: "ThePirateBay".to_string(),
                provider_short: "TPB".to_string(),
                score,
            });
        }

        Ok(results)
    }

    pub async fn search_yts(&self, query: &str, safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let url = format!(
            "https://yts.mx/api/v2/list_movies.json?query_term={}",
            encode_url(query)
        );
        let body_text = self.fetch_url(&url).await?;
        let resp: YtsResponse = serde_json::from_str(&body_text)
            .map_err(|e| JellypullError::Provider(format!("YTS parse error: {}", e)))?;

        let mut results = Vec::new();
        if let Some(data) = resp.data {
            if let Some(movies) = data.movies {
                for movie in movies {
                    if let Some(torrents) = movie.torrents {
                        for torrent in torrents {
                            let hash = torrent.hash.clone().unwrap_or_default();
                            let quality = torrent.quality.clone().unwrap_or_default();
                            let size = torrent.size.clone().unwrap_or_else(|| "Unknown".to_string());
                            let seeders = torrent.seeds.unwrap_or(0);
                            let leechers = torrent.peers.unwrap_or(0);
                            let full_title = format!("{} [{}] [YTS]", movie.title_long, quality);

                            if safe_search && is_nsfw_title(&full_title) {
                                continue;
                            }

                            let magnet = format!(
                                "magnet:?xt=urn:btih:{}&dn={}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce",
                                hash,
                                encode_url(&full_title)
                            );

                            let score = calculate_quality_score(&full_title, seeders, "YTS");

                            results.push(SearchResultItem {
                                title: full_title,
                                magnet_link: magnet,
                                size,
                                seeders,
                                leechers,
                                provider_name: "YTS".to_string(),
                                provider_short: "YTS".to_string(),
                                score,
                            });
                        }
                    }
                }
            }
        }

        Ok(results)
    }

    pub async fn search_eztv(&self, query: &str, safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let url = format!("https://eztvx.to/api/get-torrents?search={}", encode_url(query));
        let body_text = self.fetch_url(&url).await?;

        let json_val: Value = serde_json::from_str(&body_text)
            .map_err(|e| JellypullError::Provider(format!("EZTV parse error: {}", e)))?;

        let mut results = Vec::new();
        if let Some(torrents) = json_val.get("torrents").and_then(|v| v.as_array()) {
            for t in torrents {
                let title = t.get("title").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                let magnet = t.get("magnet_url").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                if title.is_empty() || magnet.is_empty() {
                    continue;
                }

                if safe_search && is_nsfw_title(&title) {
                    continue;
                }

                let seeders = parse_val_to_u32(t.get("seeds"));
                let leechers = parse_val_to_u32(t.get("peers"));
                let raw_size = parse_val_to_u64(t.get("size_bytes"));
                let formatted_size = format_bytes(raw_size);
                let score = calculate_quality_score(&title, seeders, "EZTV");

                results.push(SearchResultItem {
                    title,
                    magnet_link: magnet,
                    size: formatted_size,
                    seeders,
                    leechers,
                    provider_name: "EZTV".to_string(),
                    provider_short: "EZTV".to_string(),
                    score,
                });
            }
        }

        Ok(results)
    }

    pub async fn scrape_1337x(&self, query: &str, safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let search_url = format!("https://1337x.to/search/{}/1/", encode_url(query));
        let html_content = match self.fetch_url(&search_url).await {
            Ok(content) => content,
            Err(_) => return Ok(Vec::new()),
        };

        let mut row_data = Vec::new();
        {
            let document = Html::parse_document(&html_content);
            let row_selector = Selector::parse("table.table-list tr").unwrap();
            let name_selector = Selector::parse("td.name a:nth-child(2)").unwrap();
            let seeds_selector = Selector::parse("td.seeds").unwrap();
            let leeches_selector = Selector::parse("td.leeches").unwrap();
            let size_selector = Selector::parse("td.size").unwrap();

            for row in document.select(&row_selector) {
                let name_element = match row.select(&name_selector).next() {
                    Some(el) => el,
                    None => continue,
                };

                let title = name_element.text().collect::<Vec<_>>().join("");
                let detail_path = name_element.value().attr("href").unwrap_or_default().to_string();
                if title.is_empty() || detail_path.is_empty() {
                    continue;
                }

                if safe_search {
                    if detail_path.contains("/sub/55/")
                        || detail_path.contains("/sub/56/")
                        || detail_path.to_lowercase().contains("xxx")
                        || is_nsfw_title(&title)
                    {
                        continue;
                    }
                }

                let seeders = row
                    .select(&seeds_selector)
                    .next()
                    .and_then(|el| el.text().next())
                    .and_then(|s| s.trim().parse::<u32>().ok())
                    .unwrap_or(0);

                let leechers = row
                    .select(&leeches_selector)
                    .next()
                    .and_then(|el| el.text().next())
                    .and_then(|s| s.trim().parse::<u32>().ok())
                    .unwrap_or(0);

                let size = row
                    .select(&size_selector)
                    .next()
                    .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
                    .unwrap_or_else(|| "Unknown".to_string());

                row_data.push((title, detail_path, seeders, leechers, size));
            }
        }

        let mut results = Vec::new();
        for (title, detail_path, seeders, leechers, size) in row_data {
            let detail_url = format!("https://1337x.to{}", detail_path);
            let magnet = match self.fetch_magnet_from_1337x_detail(&detail_url).await {
                Ok(m) => m,
                Err(_) => format!("https://1337x.to{}", detail_path),
            };

            let score = calculate_quality_score(&title, seeders, "1337X");

            results.push(SearchResultItem {
                title,
                magnet_link: magnet,
                size,
                seeders,
                leechers,
                provider_name: "1337x".to_string(),
                provider_short: "1337X".to_string(),
                score,
            });
        }

        Ok(results)
    }

    pub async fn scrape_torrentgalaxy(&self, query: &str, safe_search: bool) -> Result<Vec<SearchResultItem>> {
        let search_url = format!("https://torrentgalaxy.to/torrents.php?search={}", encode_url(query));
        let html_content = match self.fetch_url(&search_url).await {
            Ok(content) => content,
            Err(_) => return Ok(Vec::new()),
        };

        let document = Html::parse_document(&html_content);
        let row_selector = Selector::parse("div.tgxtablerow").unwrap();

        let mut results = Vec::new();

        for row in document.select(&row_selector) {
            let title_el = row.select(&Selector::parse("a.tx1").unwrap()).next();
            let magnet_el = row.select(&Selector::parse("a[href^='magnet:']").unwrap()).next();
            let seeds_el = row.select(&Selector::parse("span[color='green'] font").unwrap()).next();
            let leech_el = row.select(&Selector::parse("span[color='red'] font").unwrap()).next();
            let size_el = row.select(&Selector::parse("span.badge-secondary").unwrap()).next();

            if let (Some(t_el), Some(m_el)) = (title_el, magnet_el) {
                let title = t_el.text().collect::<Vec<_>>().join("").trim().to_string();
                let magnet = m_el.value().attr("href").unwrap_or_default().to_string();
                if title.is_empty() || magnet.is_empty() {
                    continue;
                }

                if safe_search && is_nsfw_title(&title) {
                    continue;
                }

                let seeders = seeds_el.and_then(|e| e.text().next()).and_then(|s| s.trim().parse::<u32>().ok()).unwrap_or(0);
                let leechers = leech_el.and_then(|e| e.text().next()).and_then(|s| s.trim().parse::<u32>().ok()).unwrap_or(0);
                let size = size_el.map(|e| e.text().collect::<Vec<_>>().join("").trim().to_string()).unwrap_or_else(|| "Unknown".to_string());
                let score = calculate_quality_score(&title, seeders, "TGX");

                results.push(SearchResultItem {
                    title,
                    magnet_link: magnet,
                    size,
                    seeders,
                    leechers,
                    provider_name: "TorrentGalaxy".to_string(),
                    provider_short: "TGX".to_string(),
                    score,
                });
            }
        }

        Ok(results)
    }

    async fn fetch_magnet_from_1337x_detail(&self, detail_url: &str) -> Result<String> {
        let html_content = self.fetch_url(detail_url).await?;
        let document = Html::parse_document(&html_content);
        let magnet_selector = Selector::parse("a[href^='magnet:']").unwrap();

        if let Some(el) = document.select(&magnet_selector).next() {
            if let Some(href) = el.value().attr("href") {
                return Ok(href.to_string());
            }
        }

        Err(JellypullError::Provider("Magnet link not found on detail page".to_string()))
    }
}

pub fn sanitize_query(query: &str) -> String {
    let re = Regex::new(r"[\(\)\[\]]").unwrap();
    let cleaned = re.replace_all(query, " ");
    cleaned.split_whitespace().collect::<Vec<&str>>().join(" ")
}

fn parse_val_to_u32(val: Option<&Value>) -> u32 {
    match val {
        Some(Value::Number(n)) => n.as_u64().unwrap_or(0) as u32,
        Some(Value::String(s)) => s.parse::<u32>().unwrap_or(0),
        _ => 0,
    }
}

fn parse_val_to_u64(val: Option<&Value>) -> u64 {
    match val {
        Some(Value::Number(n)) => n.as_u64().unwrap_or(0),
        Some(Value::String(s)) => s.parse::<u64>().unwrap_or(0),
        _ => 0,
    }
}

pub fn calculate_quality_score(title: &str, seeders: u32, provider_short: &str) -> u32 {
    let lower = title.to_lowercase();
    let mut score = seeders.min(1000);

    if provider_short.to_uppercase() == "SOLID" || provider_short.to_lowercase() == "solidtorrents" {
        score += 10000;
    }

    if lower.contains("2160p") || lower.contains("4k") || lower.contains("uhd") {
        score += 3000;
    } else if lower.contains("1080p") || lower.contains("bluray") {
        score += 2000;
    } else if lower.contains("720p") {
        score += 1000;
    }

    if lower.contains("remux") {
        score += 500;
    } else if lower.contains("web-dl") || lower.contains("webrip") {
        score += 300;
    }

    score
}

pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub fn is_nsfw_title(title: &str) -> bool {
    let lower = title.to_lowercase();

    const NSFW_SUBSTRINGS: &[&str] = &[
        "brazzers", "naughtyamerica", "bangbros", "realitykings", "evilangel",
        "twistys", "blacked", "tushy", "vixen", "sweethearts", "mofos",
        "digitalplayground", "uncensored jav", "subbed jav", "onlyfans",
        "pornhub", "xhamster", "youporn", "xvideos", "heavy-r", "puretaboo",
        "teamskeet", "passion-hd", "lubed", "nubiles", "playboy", "hustler",
        "siterip", "javhd"
    ];

    for &sub in NSFW_SUBSTRINGS {
        if lower.contains(sub) {
            return true;
        }
    }

    let words: Vec<&str> = lower
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();

    const NSFW_WORDS: &[&str] = &[
        "xxx", "porn", "porno", "hentai", "jav", "erotic", "erotica",
        "fetish", "bdsm", "slut", "whore", "blowjob", "creampie", "milf",
        "gangbang", "cuckold", "masturbate", "masturbation", "hardcore", "taboo",
        "interracial", "threesome", "orgasm", "incest", "cumshot", "deepthroat"
    ];

    for w in words {
        if NSFW_WORDS.contains(&w) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nsfw_filter() {
        assert!(is_nsfw_title("Some.Random.Movie.XXX.1080p"));
        assert!(is_nsfw_title("Brazzers Exxtra - Video Title"));
        assert!(is_nsfw_title("Title with Hentai Uncensored"));
        assert!(is_nsfw_title("NaughtyAmerica - Scene 42"));

        // Safe titles that shouldn't trigger false positives
        assert!(!is_nsfw_title("Sussex Countryside Documentary (2023) [1080p]"));
        assert!(!is_nsfw_title("Inception (2010) [2160p] [4K] [UHD] [REMUX]"));
        assert!(!is_nsfw_title("The Classic Passage of Time"));
        assert!(!is_nsfw_title("Dune: Part Two 2024 1080p WEB-DL"));
    }
}
