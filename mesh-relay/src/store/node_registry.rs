use axum::extract::ws::Message;
use dashmap::DashMap;
use tokio::sync::mpsc;

#[derive(Clone, Default)]
pub struct NodeRegistry {
    sessions: DashMap<String, mpsc::Sender<Message>>,
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    pub fn register(&self, node_id: String, sender: mpsc::Sender<Message>) {
        self.sessions.insert(node_id, sender);
    }

    pub fn unregister(&self, node_id: &str) {
        self.sessions.remove(node_id);
    }

    pub fn get_sender(&self, node_id: &str) -> Option<mpsc::Sender<Message>> {
        self.sessions.get(node_id).map(|entry| entry.value().clone())
    }

    pub fn all_node_ids(&self) -> Vec<String> {
        self.sessions.iter().map(|entry| entry.key().clone()).collect()
    }

    pub fn active_count(&self) -> usize {
        self.sessions.len()
    }
}
