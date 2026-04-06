use governor::{clock::DefaultClock, state::keyed::DashMapStateStore, Quota, RateLimiter};
use nonzero_ext::nonzero;

pub type NodeRateLimiter = RateLimiter<String, DashMapStateStore<String>, DefaultClock>;

pub fn build_rate_limiter() -> NodeRateLimiter {
    RateLimiter::keyed(Quota::per_minute(nonzero!(100u32)))
}

pub fn enforce_rate_limit(limiter: &NodeRateLimiter, node_id: &str) -> Result<(), String> {
    limiter
        .check_key(&node_id.to_string())
        .map_err(|_| "rate limit exceeded: max 100 messages per minute".to_string())
}
