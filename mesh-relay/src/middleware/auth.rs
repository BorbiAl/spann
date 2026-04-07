use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Debug, Deserialize, Clone)]
struct NodeClaims {
    sub: String,
}

pub fn validate_node_token(token: &str, expected_node_id: &str, secret: &str) -> Result<(), String> {
    if secret.trim().is_empty() {
        return Err("token secret is not configured".to_string());
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_aud = false;
    validation.validate_exp = true;
    validation.leeway = 0;
    validation.required_spec_claims = HashSet::from(["exp".to_string(), "sub".to_string()]);

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

#[cfg(test)]
mod tests {
    use super::validate_node_token;
    use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
    use serde::Serialize;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Debug, Serialize)]
    struct Claims<'a> {
        sub: &'a str,
        exp: u64,
    }

    fn now_seconds() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_secs()
    }

    fn sign_token(sub: &str, exp: u64, secret: &str) -> String {
        encode(
            &Header::new(Algorithm::HS256),
            &Claims { sub, exp },
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .expect("token signing should succeed")
    }

    #[test]
    fn rejects_expired_token() {
        let secret = "mesh-secret";
        let token = sign_token("node-1", now_seconds().saturating_sub(5), secret);

        let result = validate_node_token(&token, "node-1", secret);
        assert!(result.is_err());
    }

    #[test]
    fn rejects_empty_secret() {
        let secret = "mesh-secret";
        let token = sign_token("node-1", now_seconds().saturating_add(300), secret);

        let result = validate_node_token(&token, "node-1", "");
        assert!(result.is_err());
    }

    #[test]
    fn accepts_valid_token() {
        let secret = "mesh-secret";
        let token = sign_token("node-1", now_seconds().saturating_add(300), secret);

        let result = validate_node_token(&token, "node-1", secret);
        assert!(result.is_ok());
    }
}
