use crate::error::{JellypullError, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvidersConfig {
    pub timeout_secs: u64,
    pub user_agent: String,
}

impl Default for ProvidersConfig {
    fn default() -> Self {
        Self {
            timeout_secs: 15,
            user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    pub providers: ProvidersConfig,
}

impl Config {
    pub fn load(path_override: Option<&Path>) -> Result<Self> {
        let path = if let Some(p) = path_override {
            p.to_path_buf()
        } else {
            Self::find_config_path()?
        };

        if !path.exists() {
            return Err(JellypullError::Config(format!(
                "Config file not found at '{}'. Run `jellypull config init` to create one.",
                path.display()
            )));
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| JellypullError::Config(format!("Failed to read config file '{}': {}", path.display(), e)))?;

        let mut config: Config = toml::from_str(&content)
            .map_err(|e| JellypullError::Config(format!("Failed to parse TOML config '{}': {}", path.display(), e)))?;

        config.validate()?;
        Ok(config)
    }

    pub fn find_config_path() -> Result<PathBuf> {
        let cwd_config = Path::new("config.toml");
        if cwd_config.exists() {
            return Ok(cwd_config.to_path_buf());
        }

        if let Some(config_dir) = dirs::config_dir() {
            let app_config = config_dir.join("jellypull").join("config.toml");
            if app_config.exists() {
                return Ok(app_config);
            }
        }

        let etc_config = Path::new("/etc/jellypull/config.toml");
        if etc_config.exists() {
            return Ok(etc_config.to_path_buf());
        }

        if let Some(config_dir) = dirs::config_dir() {
            Ok(config_dir.join("jellypull").join("config.toml"))
        } else {
            Ok(PathBuf::from("config.toml"))
        }
    }

    pub fn save_default(path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let default_config = Config::default();
        let toml_str = toml::to_string_pretty(&default_config)
            .map_err(|e| JellypullError::Config(format!("Failed to serialize config: {}", e)))?;
        fs::write(path, toml_str)?;
        Ok(())
    }

    pub fn validate(&mut self) -> Result<()> {
        if self.providers.timeout_secs == 0 {
            self.providers.timeout_secs = 15;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_validation() {
        let mut cfg = Config::default();
        cfg.providers.timeout_secs = 0;

        assert!(cfg.validate().is_ok());
        assert_eq!(cfg.providers.timeout_secs, 15);
    }
}
