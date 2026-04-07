FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    curl \
    ninja-build \
    ca-certificates \
    libleveldb-dev \
    libsnappy-dev \
    nlohmann-json3-dev \
    libasio-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Crow headers (header-only framework).
RUN git clone --depth 1 https://github.com/CrowCpp/Crow.git /tmp/Crow && \
    cp -r /tmp/Crow/include/* /usr/local/include/ && \
    rm -rf /tmp/Crow

WORKDIR /app
COPY . .

RUN cmake -S . -B build -G Ninja && cmake --build build --config Release

FROM ubuntu:24.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libleveldb1d \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r spann && useradd --no-log-init -r -g spann spann

WORKDIR /app
COPY --from=builder /app/build/mesh-daemon /app/mesh-daemon

RUN chown -R spann:spann /app
USER spann

EXPOSE 7070

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD curl -fsS http://localhost:7070/health || exit 1

CMD ["/app/mesh-daemon"]
