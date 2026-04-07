                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                use std::{env, net::SocketAddr};

#[derive(Clone, Debug)]
pub struct Config {
    pub addr: SocketAddr,
    pub redis_url: String,
    pub token_secret: String,
    pub mesh_sync_shared_token: String,
    pub fastapi_mesh_sync_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let addr = env::var("MESH_RELAY_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8090".to_string())
            .parse::<SocketAddr>()
            .map_err(|error| format!("invalid MESH_RELAY_ADDR: {error}"))?;

        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379/0".to_string());
        let token_secret = env::var("MESH_RELAY_TOKEN_SECRET")
            .map_err(|_| "MESH_RELAY_TOKEN_SECRET is required".to_string())?;
        let mesh_sync_shared_token = env::var("MESH_SYNC_SHARED_TOKEN").unwrap_or_default();
        let fastapi_mesh_sync_url = env::var("FASTAPI_MESH_SYNC_URL")
            .unwrap_or_else(|_| "http://backend:8000/mesh/sync".to_string());

        Ok(Self {
            addr,
            redis_url,
            token_secret,
            mesh_sync_shared_token,
            fastapi_mesh_sync_url,
        })
    }
}
