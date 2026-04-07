use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::handlers::relay::route_message;
use crate::middleware::auth::validate_node_token;
use crate::middleware::rate_limit::enforce_rate_limit;
use crate::models::message::{
    RegisterFrame, RelayAckFrame, RelayErrorFrame, RelayInboundFrame,
};
use crate::AppState;

const OUTBOUND_QUEUE_CAPACITY: usize = 512;
const MAX_NODE_ID_LEN: usize = 128;

fn is_valid_node_id(value: &str) -> bool {
    if value.is_empty() || value.len() > MAX_NODE_ID_LEN {
        return false;
    }
    value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == ':')
}

pub async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.max_frame_size(64 * 1024)
        .max_message_size(64 * 1024)
        .on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    let (outbound_tx, mut outbound_rx) = mpsc::channel::<Message>(OUTBOUND_QUEUE_CAPACITY);
    let send_loop = tokio::spawn(async move {
        while let Some(message) = outbound_rx.recv().await {
            if ws_sender.send(message).await.is_err() {
                return;
            }
        }
    });

    let first_message = match ws_receiver.next().await {
        Some(Ok(Message::Text(text))) => text,
        _ => {
            send_error(&outbound_tx, 4001, "first frame must be register");
            send_loop.abort();
            let _ = send_loop.await;
            return;
        }
    };

    let register: RegisterFrame = match serde_json::from_str(&first_message) {
        Ok(frame) => frame,
        Err(_) => {
            send_error(&outbound_tx, 4002, "invalid register frame JSON");
            send_loop.abort();
            let _ = send_loop.await;
            return;
        }
    };

    if register.frame_type != "register" {
        send_error(&outbound_tx, 4003, "first frame type must be register");
        send_loop.abort();
        let _ = send_loop.await;
        return;
    }

    if !is_valid_node_id(register.node_id.as_str()) {
        send_error(&outbound_tx, 4007, "invalid nodeId format");
        send_loop.abort();
        let _ = send_loop.await;
        return;
    }

    if let Err(error) = validate_node_token(&register.token, &register.node_id, &state.config.token_secret)
    {
        send_error(&outbound_tx, 4004, &format!("auth failed: {error}"));
        send_loop.abort();
        let _ = send_loop.await;
        return;
    }

    let node_id = register.node_id.clone();
    state.registry.register(node_id.clone(), outbound_tx.clone());
    info!(node_id = %node_id, active = state.registry.active_count(), "node connected");

    if let Ok(queued) = state.queue.dequeue_all(&node_id).await {
        for payload in queued {
            if let Ok(text) = serde_json::to_string(&payload) {
                if outbound_tx.try_send(Message::Text(text.into())).is_err() {
                    warn!(node_id = %node_id, "outbound queue full while replaying queued messages");
                    break;
                }
            }
        }
    }

    while let Some(frame) = ws_receiver.next().await {
        let message = match frame {
            Ok(message) => message,
            Err(error) => {
                warn!(node_id = %node_id, error = %error, "websocket receive error");
                break;
            }
        };

        let text = match message {
            Message::Text(text) => text,
            Message::Close(_) => break,
            _ => continue,
        };

        let inbound: RelayInboundFrame = match serde_json::from_str(&text) {
            Ok(frame) => frame,
            Err(_) => {
                send_error(&outbound_tx, 4005, "invalid message frame JSON");
                continue;
            }
        };

        if inbound.frame_type != "message" {
            send_error(&outbound_tx, 4006, "unsupported frame type");
            continue;
        }

        if inbound.to != "broadcast" && !is_valid_node_id(inbound.to.as_str()) {
            send_error(&outbound_tx, 4008, "invalid destination node id");
            continue;
        }

        if let Err(error) = enforce_rate_limit(&state.rate_limiter, &node_id) {
            send_error(&outbound_tx, 4291, &error);
            continue;
        }

        match route_message(&state, &node_id, &inbound.to, inbound.payload).await {
            Ok(message_id) => {
                let ack = RelayAckFrame {
                    frame_type: "ack",
                    message_id,
                };
                if let Ok(serialized) = serde_json::to_string(&ack) {
                    if outbound_tx.try_send(Message::Text(serialized.into())).is_err() {
                        warn!(node_id = %node_id, "outbound queue full while sending ack");
                        break;
                    }
                }
            }
            Err(error) => send_error(&outbound_tx, 5001, &error),
        }
    }

    state.registry.unregister(&node_id);
    info!(node_id = %node_id, active = state.registry.active_count(), "node disconnected");

    drop(outbound_tx);
    send_loop.abort();
    let _ = send_loop.await;
}

fn send_error(sender: &mpsc::Sender<Message>, code: u16, message: &str) {
    let frame = RelayErrorFrame {
        frame_type: "error",
        code,
        message: message.to_string(),
    };

    if let Ok(serialized) = serde_json::to_string(&frame) {
        let _ = sender.try_send(Message::Text(serialized.into()));
    }
}
