use serde_json::{json, Value};
use tracing::{error, info};

use crate::AppState;

pub async fn sync_delivered_messages(state: &AppState, messages: Vec<Value>) -> Result<(), String> {
    if messages.is_empty() {
        return Ok(());
    }

    let message_count = messages.len();

    let request_id = uuid::Uuid::new_v4().to_string();
    let mut request = state
        .http_client
        .post(&state.config.fastapi_mesh_sync_url)
        .header("X-Request-ID", request_id)
        .json(&json!({ "messages": messages }));

    if !state.config.mesh_sync_shared_token.trim().is_empty() {
        request = request.header("X-Mesh-Sync-Token", state.config.mesh_sync_shared_token.trim());
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("sync request failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "<unreadable body>".to_string());
        error!(status = %status, body = %body, "fastapi mesh sync failed");
        return Err(format!("sync endpoint returned non-success status: {status}"));
    }

    info!(count = message_count, "mesh messages synced to fastapi");
    Ok(())
}
