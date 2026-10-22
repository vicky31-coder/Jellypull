# Multi-stage Dockerfile for Jellypull Decoupled Microservices
FROM rust:latest as builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY web ./web

RUN cargo build --release

FROM debian:testing-slim

RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/jellypull /usr/local/bin/jellypull
COPY config.toml.example /app/config.toml.example
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8045 8046

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["jellypull", "serve", "--port", "8045"]
