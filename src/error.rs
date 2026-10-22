use thiserror::Error;

#[derive(Error, Debug)]
pub enum JellypullError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Torrent provider error: {0}")]
    Provider(String),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("TOML error: {0}")]
    Toml(#[from] toml::de::Error),
}

pub type Result<T> = std::result::Result<T, JellypullError>;
