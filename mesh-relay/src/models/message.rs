use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct RegisterFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    #[serde(rename = "nodeId")]
    pub node_id: String,
    pub token: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayInboundFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub to: String,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct RelayDeliverFrame {
    #[serde(rename = "type")]
    pub frame_type: &'static str,
    pub from: String,
    pub payload: Value,
}

#[derive(Debug, Serialize)]
pub struct RelayAckFrame {
    #[serde(rename = "type")]
    pub frame_type: &'static str,
    #[serde(rename = "messageId")]
    pub message_id: String,
}

#[derive(Debug, Serialize)]
pub struct RelayErrorFrame {
    #[serde(rename = "type")]
    pub frame_type: &'static str,
    pub code: u16,
    pub message: String,
}
