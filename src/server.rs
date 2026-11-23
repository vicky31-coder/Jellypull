use crate::config::Config;
use crate::error::Result;
use crate::providers::{SearchResultItem, TorrentScraper};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use url::form_urlencoded;

static YEAR_RE: OnceLock<Regex> = OnceLock::new();
static SE_RE: OnceLock<Regex> = OnceLock::new();
static BRACKETS_RE: OnceLock<Regex> = OnceLock::new();
static TAGS_RE: OnceLock<Regex> = OnceLock::new();

pub fn extract_quality(title: &str) -> String {
    let lower = title.to_lowercase();
    if lower.contains("2160p") || lower.contains("4k") || lower.contains("uhd") {
        "2160p".to_string()
    } else if lower.contains("1080p") || lower.contains("1080i") {
        "1080p".to_string()
    } else if lower.contains("720p") {
        "720p".to_string()
    } else if lower.contains("480p") || lower.contains("576p") || lower.contains("360p") {
        "480p".to_string()
    } else if lower.contains("bluray") || lower.contains("bdrip") || lower.contains("brrip") {
        "1080p".to_string()
    } else if lower.contains("web-dl") || lower.contains("webrip") {
        "1080p".to_string()
    } else {
        "Unknown".to_string()
    }
}

pub fn clean_torrent_name(title: &str) -> String {
    let year_re = YEAR_RE.get_or_init(|| Regex::new(r"\b(19\d{2}|20\d{2})\b").unwrap());
    let se_re = SE_RE.get_or_init(|| Regex::new(r"(?i)\b(s\d{1,2}(?:e\d{1,2})?)\b").unwrap());
    let brackets_re = BRACKETS_RE.get_or_init(|| Regex::new(r"\[[^\]]*\]|\([^\)]*\)").unwrap());
    let tags_re = TAGS_RE.get_or_init(|| {
        Regex::new(r"(?i)\b(2160p|1080p|1080i|720p|480p|4k|uhd|bluray|bdrip|brrip|web-?dl|webrip|hdrip|dvdrip|x264|x265|hevc|h264|h265|aac|dts|ac3|atmos|hdr|remux|repack|proper|yts|eztv|solid|tpb|tgx)\b").unwrap()
    });

    // Check for 4-digit release year (e.g. 1999, 2024)
    if let Some(mat) = year_re.find(title) {
        let year = mat.as_str();
        let prefix = &title[..mat.start()];
        let cleaned_prefix = prefix
            .replace(['.', '_'], " ")
            .trim_matches(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == '[' || c == ']' || c == '-' || c == ':')
            .to_string();
        let cleaned_prefix = cleaned_prefix.split_whitespace().collect::<Vec<_>>().join(" ");
        if !cleaned_prefix.is_empty() {
            return format!("{} ({})", cleaned_prefix, year);
        }
    }

    // Check for Season/Episode (e.g. S01E02 or S01)
    if let Some(mat) = se_re.find(title) {
        let se = mat.as_str().to_uppercase();
        let prefix = &title[..mat.start()];
        let cleaned_prefix = prefix
            .replace(['.', '_'], " ")
            .trim_matches(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == '[' || c == ']' || c == '-' || c == ':')
            .to_string();
        let cleaned_prefix = cleaned_prefix.split_whitespace().collect::<Vec<_>>().join(" ");
        if !cleaned_prefix.is_empty() {
            return format!("{} {}", cleaned_prefix, se);
        }
    }

    // Fallback: strip tags, brackets, and replace dots with spaces
    let without_brackets = brackets_re.replace_all(title, " ");
    let without_tags = tags_re.replace_all(&without_brackets, " ");
    let cleaned = without_tags.replace(['.', '_'], " ");
    let result = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    if result.is_empty() {
        title.to_string()
    } else {
        result
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FormattedResult {
    pub id: String,
    pub title: String,
    pub clean_name: String,
    pub quality: String,
    pub size: String,
    pub seeders: u32,
    pub magnet: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ApiResponse {
    pub query: String,
    pub results: Vec<FormattedResult>,
}

#[derive(Clone)]
pub struct CacheEntry {
    results: Vec<FormattedResult>,
    timestamp: Instant,
}

#[derive(Clone)]
pub struct AppState {
    pub scraper: TorrentScraper,
    pub cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    pub auth_password: Option<String>,
}

#[derive(Deserialize, Debug, Default)]
struct SearchQuery {
    #[serde(alias = "query")]
    q: Option<String>,
    providers: Option<String>,
    safe: Option<String>,
    limit: Option<usize>,
}

#[derive(Deserialize, Debug, Default)]
struct SearchPayload {
    #[serde(alias = "q")]
    query: Option<String>,
    providers: Option<String>,
    safe: Option<String>,
    limit: Option<usize>,
}

fn check_authenticated(headers: &HeaderMap, auth_password: &Option<String>) -> bool {
    let expected = match auth_password {
        Some(p) => p,
        None => return true,
    };

    if let Some(auth_val) = headers.get("authorization").and_then(|h| h.to_str().ok()) {
        if let Some(token) = auth_val.strip_prefix("Bearer ") {
            if token.trim() == expected {
                return true;
            }
        }
    }

    if let Some(key_val) = headers.get("x-api-key").and_then(|h| h.to_str().ok()) {
        if key_val.trim() == expected {
            return true;
        }
    }

    false
}

fn format_search_results(raw_items: &[serde_json::Value]) -> Vec<FormattedResult> {
    raw_items
        .iter()
        .enumerate()
        .filter_map(|(idx, val)| {
            let title = val.get("title").and_then(|t| t.as_str())?.to_string();
            let magnet = val
                .get("magnet")
                .or_else(|| val.get("magnet_link"))
                .and_then(|m| m.as_str())
                .unwrap_or("")
                .to_string();
            if magnet.is_empty() {
                return None;
            }
            let size = val
                .get("size")
                .and_then(|s| s.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let seeders = val
                .get("seeders")
                .and_then(|s| s.as_u64())
                .map(|s| s as u32)
                .unwrap_or(0);

            let clean_name = clean_torrent_name(&title);
            let quality = extract_quality(&title);

            Some(FormattedResult {
                id: format!("res_{}", idx + 1),
                title,
                clean_name,
                quality,
                size,
                seeders,
                magnet,
            })
        })
        .collect()
}

fn format_from_items(items: Vec<SearchResultItem>) -> Vec<FormattedResult> {
    items
        .into_iter()
        .enumerate()
        .map(|(idx, item)| {
            let clean_name = clean_torrent_name(&item.title);
            let quality = extract_quality(&item.title);
            FormattedResult {
                id: format!("res_{}", idx + 1),
                title: item.title,
                clean_name,
                quality,
                size: item.size,
                seeders: item.seeders,
                magnet: item.magnet_link,
            }
        })
        .collect()
}

async fn execute_search(
    state: &Arc<AppState>,
    query_str: &str,
    providers_opt: Option<&str>,
    safe_opt: Option<&str>,
    limit_opt: Option<usize>,
) -> std::result::Result<ApiResponse, (StatusCode, Json<serde_json::Value>)> {
    let q = query_str.trim();
    if q.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Query parameter cannot be empty",
                "example": "/?query=Dune+Part+Two+2024"
            })),
        ));
    }

    let safe_search = safe_opt.map(|s| s != "0" && s != "false").unwrap_or(true);
    let providers_str = providers_opt.unwrap_or("solid,tpb,yts,eztv,1337x,tgx");
    let cache_key = format!("{}:{}:{}", q.to_lowercase(), safe_search, providers_str);

    // 1. Check in-memory hot cache (5-minute TTL)
    {
        let reader = state.cache.read().await;
        if let Some(entry) = reader.get(&cache_key) {
            if entry.timestamp.elapsed() < Duration::from_secs(300) {
                let mut results = entry.results.clone();
                if let Some(lim) = limit_opt {
                    results.truncate(lim);
                }
                return Ok(ApiResponse {
                    query: q.to_string(),
                    results,
                });
            }
        }
    }

    // 2. Check if external standalone scraper microservice URL is configured
    if let Ok(scraper_url) = std::env::var("SCRAPER_URL") {
        let encoded_q: String = form_urlencoded::byte_serialize(q.as_bytes()).collect();
        let target_url = format!(
            "{}/scrape?q={}&safe={}&providers={}",
            scraper_url.trim_end_matches('/'),
            encoded_q,
            if safe_search { "1" } else { "0" },
            form_urlencoded::byte_serialize(providers_str.as_bytes()).collect::<String>()
        );

        let client = reqwest::Client::new();
        if let Ok(resp) = client.get(&target_url).send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(results_arr) = json.get("results").and_then(|r| r.as_array()) {
                    let formatted = format_search_results(results_arr);
                    {
                        let mut writer = state.cache.write().await;
                        writer.insert(
                            cache_key,
                            CacheEntry {
                                results: formatted.clone(),
                                timestamp: Instant::now(),
                            },
                        );
                    }
                    let mut final_results = formatted;
                    if let Some(lim) = limit_opt {
                        final_results.truncate(lim);
                    }
                    return Ok(ApiResponse {
                        query: q.to_string(),
                        results: final_results,
                    });
                }
            }
        }
    }

    // 3. Fallback to local scraper engine
    let enabled_providers: Vec<String> = providers_str
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    match state.scraper.search_fast(q, &enabled_providers, safe_search).await {
        Ok(results) => {
            let formatted = format_from_items(results);
            {
                let mut writer = state.cache.write().await;
                writer.insert(
                    cache_key,
                    CacheEntry {
                        results: formatted.clone(),
                        timestamp: Instant::now(),
                    },
                );
            }
            let mut final_results = formatted;
            if let Some(lim) = limit_opt {
                final_results.truncate(lim);
            }
            Ok(ApiResponse {
                query: q.to_string(),
                results: final_results,
            })
        }
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        )),
    }
}

async fn handle_root_or_search(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if !check_authenticated(&headers, &state.auth_password) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized. Invalid or missing API key." })),
        )
            .into_response();
    }

    match query.q {
        Some(ref q) if !q.trim().is_empty() => {
            match execute_search(
                &state,
                q,
                query.providers.as_deref(),
                query.safe.as_deref(),
                query.limit,
            )
            .await
            {
                Ok(resp) => (StatusCode::OK, Json(resp)).into_response(),
                Err((status, json)) => (status, json).into_response(),
            }
        }
        _ => (
            StatusCode::OK,
            Json(serde_json::json!({
                "service": "jellypull-api",
                "status": "online",
                "version": "0.2.0",
                "endpoints": {
                    "search_get": "/?query=<terms> or /search?query=<terms>",
                    "search_post": "/search with JSON body {\"query\": \"<terms>\"}"
                }
            })),
        )
            .into_response(),
    }
}

async fn handle_search_endpoint(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if !check_authenticated(&headers, &state.auth_password) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized. Invalid or missing API key." })),
        )
            .into_response();
    }

    let q = query.q.unwrap_or_default();
    match execute_search(
        &state,
        &q,
        query.providers.as_deref(),
        query.safe.as_deref(),
        query.limit,
    )
    .await
    {
        Ok(resp) => (StatusCode::OK, Json(resp)).into_response(),
        Err((status, json)) => (status, json).into_response(),
    }
}

async fn handle_search_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<SearchPayload>,
) -> impl IntoResponse {
    if !check_authenticated(&headers, &state.auth_password) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized. Invalid or missing API key." })),
        )
            .into_response();
    }

    let q = payload.query.unwrap_or_default();
    match execute_search(
        &state,
        &q,
        payload.providers.as_deref(),
        payload.safe.as_deref(),
        payload.limit,
    )
    .await
    {
        Ok(resp) => (StatusCode::OK, Json(resp)).into_response(),
        Err((status, json)) => (status, json).into_response(),
    }
}

async fn handle_backend_scrape(
    State(scraper): State<Arc<TorrentScraper>>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let q = match query.q {
        Some(s) if !s.trim().is_empty() => s,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Query parameter 'q' or 'query' cannot be empty" })),
            );
        }
    };

    let safe_search = query.safe.as_deref().map(|s| s != "0" && s != "false").unwrap_or(true);

    let enabled_providers: Vec<String> = query
        .providers
        .as_deref()
        .unwrap_or("solid,tpb,yts,eztv,1337x,tgx")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    match scraper.search_fast(&q, &enabled_providers, safe_search).await {
        Ok(results) => (StatusCode::OK, Json(serde_json::json!({ "results": results }))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        ),
    }
}

pub async fn start_server(config: Config, port: u16) -> Result<()> {
    run_server(port, config).await
}

pub async fn run_scraper_service(config: &Config, port: u16) -> Result<()> {
    run_scraper_server(port, config).await
}

pub async fn run_server(port: u16, config: Config) -> Result<()> {
    let scraper = TorrentScraper::new(&config.providers)?;
    let auth_password = std::env::var("JELLYPULL_PASSWORD")
        .or_else(|_| std::env::var("AUTH_PASSWORD"))
        .ok()
        .filter(|s| !s.trim().is_empty());

    let state = Arc::new(AppState {
        scraper,
        cache: Arc::new(RwLock::new(HashMap::new())),
        auth_password,
    });

    let app = Router::new()
        .route("/", get(handle_root_or_search).post(handle_search_post))
        .route("/search", get(handle_search_endpoint).post(handle_search_post))
        .route("/api/search", get(handle_search_endpoint).post(handle_search_post))
        .route("/health", get(|| async { Json(serde_json::json!({"status": "ok"})) }))
        .layer(CorsLayer::permissive())
        .layer(CompressionLayer::new())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("=========================================");
    println!("🚀 Launching Jellypull REST API Server...");
    println!("API listening at http://0.0.0.0:{}", port);
    println!("=========================================\n");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

pub async fn run_scraper_server(port: u16, config: &Config) -> Result<()> {
    let scraper = Arc::new(TorrentScraper::new(&config.providers)?);
    let app = Router::new()
        .route("/scrape", get(handle_backend_scrape))
        .route("/health", get(|| async { Json(serde_json::json!({"status": "ok"})) }))
        .layer(CorsLayer::permissive())
        .layer(CompressionLayer::new())
        .with_state(scraper);

    let bind_ip: std::net::IpAddr = std::env::var("SCRAPER_HOST")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED));
    let addr = SocketAddr::new(bind_ip, port);
    println!("=========================================");
    println!("⚡ Launching Standalone Scraper Microservice...");
    println!("Listening for backend scrape requests at http://{}:{}", bind_ip, port);
    println!("=========================================\n");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_torrent_name() {
        assert_eq!(
            clean_torrent_name("Dune.Part.Two.2024.1080p.BluRay.x264"),
            "Dune Part Two (2024)"
        );
        assert_eq!(
            clean_torrent_name("The.Batman.2022.2160p.UHD.BluRay.x265-SPARKS"),
            "The Batman (2022)"
        );
        assert_eq!(
            clean_torrent_name("Breaking.Bad.S05E14.1080p.BluRay.x264"),
            "Breaking Bad S05E14"
        );
    }

    #[test]
    fn test_extract_quality() {
        assert_eq!(extract_quality("Dune.Part.Two.2024.1080p.BluRay.x264"), "1080p");
        assert_eq!(extract_quality("Oppenheimer.2023.2160p.UHD"), "2160p");
        assert_eq!(extract_quality("Movie.720p.HD"), "720p");
    }
}
