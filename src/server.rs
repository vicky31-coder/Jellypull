use crate::config::Config;
use crate::error::Result;
use crate::providers::TorrentScraper;
use axum::{
    extract::{Query, State},
    http::{header::{HeaderName, HeaderValue}, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Sse},
    response::sse::Event,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::StreamExt;
use tower_http::compression::CompressionLayer;
use tower_http::cors::CorsLayer;
use tower_http::set_header::SetResponseHeaderLayer;
use url::form_urlencoded;

#[derive(Clone)]
pub struct CacheEntry {
    results: Vec<serde_json::Value>,
    timestamp: Instant,
}

#[derive(Clone)]
pub struct AppState {
    pub scraper: TorrentScraper,
    pub cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    pub auth_password: Option<String>,
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
    providers: Option<String>,
    safe: Option<String>,
}

#[derive(Deserialize)]
struct LoginRequest {
    password: String,
}

#[derive(Serialize)]
struct AuthStatusResponse {
    auth_required: bool,
    authenticated: bool,
}

pub async fn start_server(config: Config, port: u16) -> Result<()> {
    run_server(port, config).await
}

pub async fn run_scraper_service(config: &Config, port: u16) -> Result<()> {
    run_scraper_server(port, config).await
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

    if let Some(cookie_val) = headers.get("cookie").and_then(|h| h.to_str().ok()) {
        for cookie in cookie_val.split(';') {
            let mut parts = cookie.trim().splitn(2, '=');
            if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                if k == "jellypull_session" && v == expected {
                    return true;
                }
            }
        }
    }

    false
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
        .route("/", get(serve_index))
        .route("/api/auth/status", get(handle_auth_status))
        .route("/api/auth/login", post(handle_auth_login))
        .route("/api/auth/logout", post(handle_auth_logout))
        .route("/api/search", get(handle_search))
        .route("/api/search/stream", get(handle_search_stream))
        .route("/health", get(|| async { Json(serde_json::json!({"status": "ok"})) }))
        .layer(CorsLayer::permissive())
        .layer(CompressionLayer::new())
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("=========================================");
    println!("🚀 Launching Jellypull Web UI Server...");
    println!("Open your browser at http://localhost:{}", port);
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

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("=========================================");
    println!("⚡ Launching Standalone Scraper Microservice...");
    println!("Listening for backend scrape requests at http://localhost:{}", port);
    println!("=========================================\n");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn serve_index() -> impl IntoResponse {
    let html_content = include_str!("../web/index.html");
    Html(html_content)
}

async fn handle_auth_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let auth_required = state.auth_password.is_some();
    let authenticated = check_authenticated(&headers, &state.auth_password);

    Json(AuthStatusResponse {
        auth_required,
        authenticated,
    })
}

async fn handle_auth_login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    match &state.auth_password {
        Some(expected) => {
            if payload.password == *expected {
                let cookie_header = format!(
                    "jellypull_session={}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000",
                    expected
                );
                (
                    StatusCode::OK,
                    [(axum::http::header::SET_COOKIE, cookie_header)],
                    Json(serde_json::json!({
                        "status": "ok",
                        "token": expected,
                        "authenticated": true
                    })),
                )
            } else {
                (
                    StatusCode::UNAUTHORIZED,
                    [(axum::http::header::SET_COOKIE, String::new())],
                    Json(serde_json::json!({
                        "error": "Invalid instance password",
                        "authenticated": false
                    })),
                )
            }
        }
        None => (
            StatusCode::OK,
            [(axum::http::header::SET_COOKIE, String::new())],
            Json(serde_json::json!({
                "status": "ok",
                "message": "No password configured on this instance",
                "authenticated": true
            })),
        ),
    }
}

async fn handle_auth_logout() -> impl IntoResponse {
    let clear_cookie = "jellypull_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
    (
        StatusCode::OK,
        [(axum::http::header::SET_COOKIE, clear_cookie)],
        Json(serde_json::json!({ "status": "logged_out" })),
    )
}

async fn handle_backend_scrape(
    State(scraper): State<Arc<TorrentScraper>>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if query.q.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Query parameter 'q' cannot be empty" })),
        );
    }

    let safe_search = query.safe.as_deref().map(|s| s != "0" && s != "false").unwrap_or(true);

    let enabled_providers: Vec<String> = query
        .providers
        .as_deref()
        .unwrap_or("solid,tpb,yts,eztv,1337x,tgx")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    match scraper.search_fast(&query.q, &enabled_providers, safe_search).await {
        Ok(results) => (StatusCode::OK, Json(serde_json::json!({ "results": results }))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        ),
    }
}

async fn handle_search(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if !check_authenticated(&headers, &state.auth_password) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized. Please enter the instance password." })),
        );
    }

    if query.q.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Query parameter 'q' cannot be empty" })),
        );
    }

    let safe_search = query.safe.as_deref().map(|s| s != "0" && s != "false").unwrap_or(true);
    let providers_str = query.providers.as_deref().unwrap_or("solid,tpb,yts,eztv,1337x,tgx");

    // In-memory hot cache check (5-minute TTL)
    let cache_key = format!("{}:{}:{}", query.q.trim().to_lowercase(), safe_search, providers_str);
    {
        let reader = state.cache.read().await;
        if let Some(entry) = reader.get(&cache_key) {
            if entry.timestamp.elapsed() < Duration::from_secs(300) {
                return (
                    StatusCode::OK,
                    Json(serde_json::json!({ "results": entry.results, "cached": true })),
                );
            }
        }
    }

    // Check if external standalone scraper microservice URL is configured
    if let Ok(scraper_url) = std::env::var("SCRAPER_URL") {
        let encoded_q: String = form_urlencoded::byte_serialize(query.q.as_bytes()).collect();
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
                    let mut writer = state.cache.write().await;
                    writer.insert(
                        cache_key,
                        CacheEntry {
                            results: results_arr.clone(),
                            timestamp: Instant::now(),
                        },
                    );
                }
                return (StatusCode::OK, Json(json));
            }
        }
    }

    // Fallback to local scraper engine
    let enabled_providers: Vec<String> = providers_str
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    match state.scraper.search_fast(&query.q, &enabled_providers, safe_search).await {
        Ok(results) => {
            let items: Vec<serde_json::Value> = results
                .into_iter()
                .map(|r| {
                    serde_json::json!({
                        "title": r.title,
                        "magnet_link": r.magnet_link,
                        "size": r.size,
                        "seeders": r.seeders,
                        "leechers": r.leechers,
                        "provider_name": r.provider_name,
                        "provider_short": r.provider_short,
                        "score": r.score
                    })
                })
                .collect();

            // Cache the result
            {
                let mut writer = state.cache.write().await;
                writer.insert(
                    cache_key,
                    CacheEntry {
                        results: items.clone(),
                        timestamp: Instant::now(),
                    },
                );
            }

            (StatusCode::OK, Json(serde_json::json!({ "results": items })))
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err.to_string() })),
        ),
    }
}

async fn handle_search_stream(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if !check_authenticated(&headers, &state.auth_password) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        )
            .into_response();
    }

    let safe_search = query.safe.as_deref().map(|s| s != "0" && s != "false").unwrap_or(true);

    let enabled_providers: Vec<String> = query
        .providers
        .as_deref()
        .unwrap_or("solid,tpb,yts,eztv,1337x,tgx")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let rx = state.scraper.search_stream_enabled(&query.q, &enabled_providers, safe_search).await;
    let stream = ReceiverStream::new(rx).map(|(provider, items)| {
        let payload = serde_json::json!({
            "provider": provider,
            "items": items,
        });
        Ok::<Event, Infallible>(Event::default().event("provider_results").data(payload.to_string()))
    });

    Sse::new(stream).into_response()
}
