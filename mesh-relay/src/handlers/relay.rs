use axum::extract::ws::Message;
use serde_json::{json, Value};
use tracing::{info, warn};

use crate::handlers::sync::sync_delivered_messages;
use crate::models::message::RelayDeliverFrame;
use crate::AppState;

pub async fn route_message(
    state: &AppState,
    from_node: &str,
    to: &str,
    payload: Value,
) -> Result<String, String> {
    let message_id = payload
        .get("id")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let mut delivered_payloads: Vec<Value> = Vec::new();

    if to == "broadcast" {
        for node_id in state.registry.all_node_ids() {
            if node_id == from_node {
                continue;
            }

            if send_to_node(state, from_node, &node_id, payload.clone()).await? {
                delivered_payloads.push(payload.clone());
            }
        }
    } else if send_to_node(state, from_node, to, payload.clone()).await? {
        delivered_payloads.push(payload.clone());
    }

    if let Err(error) = sync_delivered_messages(state, delivered_payloads).await {
        warn!(error = %error, "failed to sync delivered relay messages");
    }

    Ok(message_id)
}

async fn send_to_node(
    state: &AppState,
    from_node: &str,
    destination_node: &str,
    payload: Value,
) -> Result<bool, String> {
    let deliver_frame = RelayDeliverFrame {
        frame_type: "message",
        from: from_node.to_string(),
        payload: payload.clone(),
    };

    let serialized = serde_json::to_string(&deliver_frame)
        .map_err(|error| format!("failed to serialize deliver frame: {error}"))?;

    if let Some(sender) = state.registry.get_sender(destination_node) {
        sender
            .send(Message::Text(serialized.into()))
            .map_err(|error| format!("failed to dispatch message to live node: {error}"))?;

        info!(from = from_node, to = destination_node, "relay delivered to live node");
        Ok(true)
    } else {
        state
            .queue
            .enqueue(destination_node, &json!({
                "type": "message",
                "from": from_node,
                "payload": payload,
            }))
            .await?;

        info!(to = destination_node, "relay queued message for offline node");
        Ok(false)
    }
}
