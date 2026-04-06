use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct NodeSession {
    #[serde(rename = "nodeId")]
    pub node_id: String,
    #[serde(rename = "connectedAt")]
    pub connected_at: i64,
}
