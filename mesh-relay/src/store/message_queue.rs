use deadpool_redis::{redis::AsyncCommands, Pool};
use serde_json::Value;

#[derive(Clone)]
pub struct MessageQueue {
    pool: Pool,
}

impl MessageQueue {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    pub async fn enqueue(&self, node_id: &str, payload: &Value) -> Result<(), String> {
        let mut connection = self
            .pool
            .get()
            .await
            .map_err(|error| format!("redis pool error: {error}"))?;

        let key = format!("mesh:queue:{node_id}");
        let payload_json = serde_json::to_string(payload)
            .map_err(|error| format!("queue serialization error: {error}"))?;

        let _: () = connection
            .rpush(key, payload_json)
            .await
            .map_err(|error| format!("redis enqueue error: {error}"))?;
        Ok(())
    }

    pub async fn dequeue_all(&self, node_id: &str) -> Result<Vec<Value>, String> {
        let mut connection = self
            .pool
            .get()
            .await
            .map_err(|error| format!("redis pool error: {error}"))?;

        let key = format!("mesh:queue:{node_id}");
        let rows: Vec<String> = connection
            .lrange(&key, 0, -1)
            .await
            .map_err(|error| format!("redis lrange error: {error}"))?;

        if !rows.is_empty() {
            let _: () = connection
                .del(&key)
                .await
                .map_err(|error| format!("redis delete queue error: {error}"))?;
        }

        let mut payloads = Vec::with_capacity(rows.len());
        for row in rows {
            if let Ok(value) = serde_json::from_str::<Value>(&row) {
                payloads.push(value);
            }
        }

        Ok(payloads)
    }
}
