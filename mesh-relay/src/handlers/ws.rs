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

pub async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    let (outbound_tx, mut outbound_rx) = mpsc::unbounded_channel::<Message>();
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
            return;
        }
    };

    let register: RegisterFrame = match serde_json::from_str(&first_message) {
        Ok(frame) => frame,
        Err(_) => {
            send_error(&outbound_tx, 4002, "invalid register frame JSON");
            send_loop.abort();
            return;
        }
    };

    if register.frame_type != "register" {
        send_error(&outbound_tx, 4003, "first frame type must be register");
        send_loop.abort();
        return;
    }

    if let Err(error) = validate_node_token(&register.token, &register.node_id, &state.config.token_secret)
    {
        send_error(&outbound_tx, 4004, &format!("auth failed: {error}"));
        send_loop.abort();
        return;
    }

    let node_id = register.node_id.clone();
    state.registry.register(node_id.clone(), outbound_tx.clone());
    info!(node_id = %node_id, active = state.registry.active_count(), "node connected");

    if let Ok(queued) = state.queue.dequeue_all(&node_id).await {
        for payload in queued {
            if let Ok(text) = serde_json::to_string(&payload) {
                let _ = outbound_tx.send(Message::Text(text.into()));
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
                    let _ = outbound_tx.send(Message::Text(serialized.into()));
                }
            }
            Err(error) => send_error(&outbound_tx, 5001, &error),
        }
    }

    state.registry.unregister(&node_id);
    info!(node_id = %node_id, active = state.registry.active_count(), "node disconnected");

    send_loop.abort();
}

fn send_error(sender: &mpsc::UnboundedSender<Message>, code: u16, message: &str) {
    let frame = RelayErrorFrame {
        frame_type: "error",
        code,
        message: message.to_string(),
    };

    if let Ok(serialized) = serde_json::to_string(&frame) {
        let _ = sender.send(Message::Text(serialized.into()));
    }
}
