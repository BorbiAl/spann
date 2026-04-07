FROM rust:1.88-alpine3.22 AS builder

RUN apk add --no-cache build-base

WORKDIR /app

COPY Cargo.toml Cargo.toml
COPY src src

RUN cargo build --release

FROM alpine:3.22 AS runtime

RUN apk add --no-cache ca-certificates wget \
    && addgroup -S spann \
    && adduser -S spann -G spann

WORKDIR /app
COPY --from=builder /app/target/release/mesh-relay /app/mesh-relay

RUN chown -R spann:spann /app
USER spann

EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget --spider -q http://localhost:8090/health || exit 1

CMD ["/app/mesh-relay"]
