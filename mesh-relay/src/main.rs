mod config;
mod handlers;
mod middleware;
mod models;
mod store;

use std::sync::Arc;
use std::time::Instant;

use axum::{extract::State, routing::get, Json, Router};
use deadpool_redis::{Config as RedisConfig, Runtime};
use middleware::rate_limit::{build_rate_limiter, NodeRateLimiter};
use serde_json::json;
use store::{message_queue::MessageQueue, node_registry::NodeRegistry};
use tokio::signal;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use crate::config::Config;

pub struct AppState {
    config: Config,
    registry: NodeRegistry,
    queue: MessageQueue,
    rate_limiter: NodeRateLimiter,
    http_client: reqwest::Client,
    started_at: Instant,
}

#[tokio::main]
async fn main() {
    init_tracing();

    let config = match Config::from_env() {
        Ok(config) => config,
        Err(error) => {
            error!(error = %error, "invalid configuration");
            std::process::exit(1);
        }
    };

    let redis_pool = match build_redis_pool(&config.redis_url) {
        Ok(pool) => pool,
        Err(error) => {
            error!(error = %error, "failed to create redis pool");
            std::process::exit(1);
        }
    };

    let state = Arc::new(AppState {
        config: config.clone(),
        registry: NodeRegistry::new(),
        queue: MessageQueue::new(redis_pool),
        rate_limiter: build_rate_limiter(),
        http_client: reqwest::Client::new(),
        started_at: Instant::now(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(handlers::ws::ws_upgrade))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(config.addr)
        .await
        .unwrap_or_else(|error| {
            error!(error = %error, "failed to bind listener");
            std::process::exit(1);
        });

    info!(addr = %config.addr, "mesh relay listening");

    if let Err(error) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        error!(error = %error, "server failed");
    }
}

async fn health(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime": state.started_at.elapsed().as_secs()
    }))
}

fn build_redis_pool(redis_url: &str) -> Result<deadpool_redis::Pool, String> {
    let config = RedisConfig::from_url(redis_url);
    config
        .create_pool(Some(Runtime::Tokio1))
        .map_err(|error| format!("redis pool init failed: {error}"))
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .json()
        .with_current_span(true)
        .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE)
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = signal::ctrl_c().await {
            error!(error = %error, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(error) => {
                error!(error = %error, "failed to install terminate signal handler");
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("shutdown signal received");
}
