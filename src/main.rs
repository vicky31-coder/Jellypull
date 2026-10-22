mod config;
mod error;
mod providers;
mod server;

use clap::{Args, Parser, Subcommand};
use config::Config;
use error::{JellypullError, Result};
use providers::TorrentScraper;
use std::io::{self, Write};
use std::path::PathBuf;
use colored::Colorize;

#[derive(Parser, Debug)]
#[command(
    name = "jellypull",
    author = "Antigravity Systems",
    version = "0.1.0",
    about = "Multi-provider torrent search CLI and web UI for Jellyfin media acquisition"
)]
struct Cli {
    #[arg(short, long, global = true, help = "Path to custom config file")]
    config: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    #[command(about = "Start the Web UI dashboard and REST API server")]
    Serve(ServeArgs),

    #[command(about = "Start the standalone scraper microservice")]
    Scraper(ScraperArgs),

    #[command(about = "Search torrent providers for a media query")]
    Search(SearchArgs),

    #[command(about = "Manage jellypull configuration")]
    Config(ConfigArgs),
}

#[derive(Args, Debug)]
struct ServeArgs {
    #[arg(short, long, default_value_t = 8080, help = "Port to listen on for Web UI & API")]
    port: u16,
}

#[derive(Args, Debug)]
struct ScraperArgs {
    #[arg(short, long, default_value_t = 8046, help = "Port to listen on for Scraper Microservice")]
    port: u16,
}

#[derive(Args, Debug)]
struct SearchArgs {
    #[arg(help = "Search query string (e.g. 'Ubuntu 24.04')")]
    query: String,

    #[arg(short, long, help = "Select torrent interactively from search results")]
    interactive: bool,

    #[arg(short, long, help = "Copy magnet for the search result by index number (1-indexed)")]
    copy_index: Option<usize>,
}

#[derive(Args, Debug)]
struct ConfigArgs {
    #[command(subcommand)]
    command: ConfigSubcommands,
}

#[derive(Subcommand, Debug)]
enum ConfigSubcommands {
    #[command(about = "Generate default config file")]
    Init {
        #[arg(short, long, help = "Overwrite existing config file if present")]
        force: bool,
    },
    #[command(about = "Display current configuration settings")]
    Show,
    #[command(about = "Print configuration file path")]
    Path,
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("{} {}", "[ERROR]".bold().red(), e);
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let cli = Cli::parse();

    if let Commands::Config(ref config_args) = cli.command {
        match &config_args.command {
            ConfigSubcommands::Init { force } => {
                let target_path = cli
                    .config
                    .clone()
                    .unwrap_or_else(|| Config::find_config_path().unwrap_or_else(|_| PathBuf::from("config.toml")));

                if target_path.exists() && !force {
                    println!(
                        "Config file already exists at '{}'. Use --force to overwrite.",
                        target_path.display()
                    );
                    return Ok(());
                }

                Config::save_default(&target_path)?;
                println!(
                    "{} Created default config file at '{}'",
                    "✔".bold().green(),
                    target_path.display()
                );
                return Ok(());
            }
            ConfigSubcommands::Path => {
                let p = Config::find_config_path()?;
                println!("{}", p.display());
                return Ok(());
            }
            ConfigSubcommands::Show => {
                let config = Config::load(cli.config.as_deref())?;
                let toml_str = toml::to_string_pretty(&config)
                    .map_err(|e| JellypullError::Config(e.to_string()))?;
                println!("{}", toml_str);
                return Ok(());
            }
        }
    }

    let config = Config::load(cli.config.as_deref())?;
    let scraper = TorrentScraper::new(&config.providers)?;

    match cli.command {
        Commands::Serve(args) => {
            println!("{}", "=========================================".cyan());
            println!("{}", "🚀 Launching Jellypull Web UI Server...".bold().green());
            println!("Open your browser at {}", format!("http://localhost:{}", args.port).bold().yellow());
            println!("{}", "=========================================\n".cyan());

            server::start_server(config, args.port).await?;
        }

        Commands::Scraper(args) => {
            println!("{}", "=========================================".cyan());
            println!("{}", "⚡ Launching Standalone Scraper Microservice...".bold().green());
            println!("Listening for backend scrape requests at {}", format!("http://localhost:{}", args.port).bold().yellow());
            println!("{}", "=========================================\n".cyan());

            server::run_scraper_service(&config, args.port).await?;
        }

        Commands::Search(args) => {
            println!(
                "{} Searching torrent providers for '{}'...",
                "🔍".bold().blue(),
                args.query.bold()
            );

            let results = scraper.search(&args.query).await?;

            println!("\nFound {} results:\n", results.len().to_string().green());
            println!(
                "{:<4} {:<55} {:<10} {:<8} {:<8} {:<12}",
                "#".bold(),
                "Title".bold(),
                "Size".bold(),
                "Seeds".bold(),
                "Leech".bold(),
                "Provider".bold()
            );
            println!("{}", "-".repeat(100).dimmed());

            for (idx, item) in results.iter().enumerate() {
                let display_title: String = item.title.chars().take(50).collect();
                println!(
                    "{:<4} {:<55} {:<10} {:<8} {:<8} {:<12}",
                    (idx + 1).to_string().cyan(),
                    display_title,
                    item.size.yellow(),
                    item.seeders.to_string().bold().green(),
                    item.leechers.to_string().red(),
                    item.provider_name.dimmed()
                );
            }

            if let Some(idx) = args.copy_index {
                if idx == 0 || idx > results.len() {
                    return Err(JellypullError::Provider(format!(
                        "Invalid index {}. Must be between 1 and {}",
                        idx,
                        results.len()
                    )));
                }
                let item = &results[idx - 1];
                println!(
                    "\n{} Magnet for '{}':",
                    "🧲".bold().blue(),
                    item.title.bold()
                );
                println!("{}", item.magnet_link.bright_blue());
            } else if args.interactive {
                print!("\nEnter index to print magnet (1-{}) [or press Enter to cancel]: ", results.len());
                io::stdout().flush()?;
                let mut input = String::new();
                io::stdin().read_line(&mut input)?;
                let trimmed = input.trim();
                if trimmed.is_empty() {
                    println!("Operation cancelled.");
                    return Ok(());
                }
                let idx: usize = trimmed
                    .parse()
                    .map_err(|_| JellypullError::Provider("Invalid numerical input".to_string()))?;
                if idx == 0 || idx > results.len() {
                    return Err(JellypullError::Provider(format!("Selection {} out of range", idx)));
                }
                let item = &results[idx - 1];
                println!(
                    "\n{} Magnet for '{}':",
                    "🧲".bold().blue(),
                    item.title.bold()
                );
                println!("{}", item.magnet_link.bright_blue());
            } else {
                println!(
                    "\nTip: Use `{}` or `{}` to print a magnet link.",
                    "jellypull search \"query\" --interactive".bold().yellow(),
                    "jellypull search \"query\" --copy-index 1".bold().yellow()
                );
            }
        }

        Commands::Config(_) => unreachable!(),
    }

    Ok(())
}
