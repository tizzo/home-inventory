# Starting Just MinIO

## Quick Start

```bash
cd /Users/htyson/.cursor/worktrees/home-inventory/pay

# Start MinIO
docker-compose up -d minio

# Create the bucket (runs once)
docker-compose up -d minio-init

# Check bucket was created
docker-compose logs minio-init
```

## Verify MinIO is Running

```bash
# Check container status
docker-compose ps minio

# Check MinIO health
curl http://localhost:9000/minio/health/live

# Access MinIO console
# http://localhost:9001
# Login: minioadmin / minioadmin
```

## Verify Bucket Exists

```bash
# Using MinIO client in container
docker-compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker-compose exec minio mc ls local/
```

You should see `home-inventory-photos` in the list.

## Troubleshooting

### Bucket Not Created
```bash
# Re-run init
docker-compose up -d minio-init
docker-compose logs minio-init
```

### MinIO Not Starting
```bash
# Check logs
docker-compose logs minio

# Restart
docker-compose restart minio
```
