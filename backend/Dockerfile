# Development Dockerfile for Rust backend
FROM rust:1.75-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install cargo-watch for hot reloading
RUN cargo install cargo-watch

# Copy dependency files first for better caching
COPY Cargo.toml Cargo.lock* ./

# Create a dummy main.rs to build dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code
COPY . .

# Build the application
RUN cargo build --release

# Expose port
EXPOSE 3000

# Run the application with cargo watch for hot reloading
CMD ["cargo", "watch", "-x", "run"]
