use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
struct NodeClaims {
    sub: String,
    exp: usize,
}

pub fn validate_node_token(token: &str, expected_node_id: &str, secret: &str) -> Result<(), String> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_aud = false;

    let data = decode::<NodeClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|error| format!("invalid token: {error}"))?;

    if data.claims.sub != expected_node_id {
        return Err("token subject does not match nodeId".to_string());
    }

    Ok(())
}
