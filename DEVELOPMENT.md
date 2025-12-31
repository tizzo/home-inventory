# Home Inventory System - Development Guide

## Quick Start

### Prerequisites Installation

```bash
# macOS with Homebrew
brew install rust postgresql node awscli pulumi

# Linux (Ubuntu/Debian)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo apt install postgresql-15 nodejs npm
# Install AWS CLI and Pulumi from official sites
```

### Initial Setup

1. **Clone and Setup Environment**
```bash
git clone <your-repo>
cd home-inventory

# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. **Start Local Database**
```bash
# Using Docker
docker run -d \
  --name inventory-db \
  -e POSTGRES_DB=inventory \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=devpass \
  -p 5432:5432 \
  postgres:15

# Or using local PostgreSQL
createdb inventory
```

3. **Configure Environment Variables**

**Backend (.env):**
```bash
DATABASE_URL=postgresql://postgres:devpass@localhost:5432/inventory
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=<will-set-after-deployment>
COGNITO_CLIENT_ID=<will-set-after-deployment>
COGNITO_DOMAIN=<will-set-after-deployment>
PHOTOS_BUCKET=home-inventory-photos-dev
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:3000
VITE_COGNITO_DOMAIN=<will-set-after-deployment>
```

4. **Install Dependencies and Run Migrations**
```bash
# Backend
cd backend
cargo install sqlx-cli --no-default-features --features postgres
sqlx migrate run

# Frontend
cd ../frontend
npm install

# Infrastructure
cd ../infrastructure
npm install
```

5. **Start Development Servers**
```bash
# Terminal 1: Backend
cd backend
cargo run

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit http://localhost:5173 to see the app.

## Development Workflow

### Database Migrations

**Create a new migration:**
```bash
cd backend
sqlx migrate add create_new_table
# Edit the new file in migrations/
sqlx migrate run
```

**Revert last migration:**
```bash
sqlx migrate revert
```

**Migration best practices:**
- Always test migrations locally first
- Include both `up` and `down` migrations
- Never modify existing migrations after deployment
- Use transactions for complex migrations

### Type Generation

The backend generates TypeScript types for the frontend:

```bash
cd backend
cargo test --no-run  # Triggers typeshare
cp target/debug/build/*/out/bindings.ts ../frontend/src/types/generated.ts

# Or use the frontend script
cd frontend
npm run generate-types
```

### Testing

**Backend:**
```bash
cd backend

# Unit tests
cargo test

# Integration tests (requires database)
cargo test --features integration-tests

# Test specific module
cargo test --lib models::room

# Watch mode
cargo watch -x test
```

**Frontend:**
```bash
cd frontend

# Unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Code Quality

**Backend:**
```bash
# Format code
cargo fmt

# Lint
cargo clippy -- -D warnings

# Check without building
cargo check
```

**Frontend:**
```bash
# Lint
npm run lint

# Type check
npm run type-check

# Format (if using Prettier)
npm run format
```

## Deployment

### First-Time Setup

1. **Configure Pulumi Secrets**
```bash
cd infrastructure
pulumi login
pulumi stack init production

# Set configuration
pulumi config set aws:region us-east-1
pulumi config set domain yourdomain.com
pulumi config set cloudflare:apiToken <token> --secret
pulumi config set cloudflare:accountId <account-id>
pulumi config set googleClientId <client-id> --secret
pulumi config set googleClientSecret <client-secret> --secret
```

2. **Google OAuth Setup**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://auth-yourdomain.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
     - `http://localhost:5173/auth/callback` (for local dev)

3. **Deploy Infrastructure**
```bash
cd infrastructure
pulumi up
```

This creates:
- Aurora DSQL cluster
- Lambda function
- API Gateway
- Cognito user pool
- S3 buckets
- Cloudflare Pages

4. **Update Environment Variables**

After deployment, update your local `.env` files with the output values:
```bash
pulumi stack output cognitoUserPoolId
pulumi stack output cognitoClientId
pulumi stack output cognitoDomain
```

### Subsequent Deployments

**Backend:**
```bash
cd backend
docker build -t home-inventory-backend .
# Push to ECR (Pulumi handles this)
cd ../infrastructure
pulumi up
```

**Frontend:**
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=home-inventory
```

**Infrastructure changes:**
```bash
cd infrastructure
pulumi preview  # See what will change
pulumi up       # Apply changes
```

## Debugging

### Backend

**Local debugging with VS Code:**

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Backend",
      "cargo": {
        "args": ["run", "--bin", "bootstrap"]
      },
      "args": [],
      "cwd": "${workspaceFolder}/backend",
      "env": {
        "DATABASE_URL": "postgresql://postgres:devpass@localhost:5432/inventory",
        "RUST_LOG": "debug"
      }
    }
  ]
}
```

**View logs:**
```bash
# Local
RUST_LOG=debug cargo run

# Lambda (CloudWatch)
aws logs tail /aws/lambda/inventory-api-function --follow
```

### Frontend

**Browser DevTools:**
- React DevTools extension
- Network tab for API calls
- Console for errors

**React Query DevTools:**
Automatically included in development mode - shows all queries and their state.

## Common Issues

### Database Connection Errors

**Issue:** `connection refused` or `authentication failed`

**Solution:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Migration Errors

**Issue:** Migration fails or schema out of sync

**Solution:**
```bash
# Reset database (CAUTION: deletes all data)
sqlx database drop
sqlx database create
sqlx migrate run

# Or revert and re-run
sqlx migrate revert
sqlx migrate run
```

### CORS Errors

**Issue:** Browser blocks API requests

**Solution:**
- Check `FRONTEND_URL` is set correctly in backend
- Verify CORS headers in browser Network tab
- Ensure `withCredentials: true` in frontend API client

### Type Generation Issues

**Issue:** TypeScript types don't match Rust types

**Solution:**
```bash
# Regenerate types
cd backend
cargo clean
cargo test --no-run
cd ../frontend
npm run generate-types
```

### Lambda Cold Starts

**Issue:** First request after deployment is slow

**Solution:**
- Expected behavior - migrations run on first invocation
- Subsequent requests are fast
- Consider provisioned concurrency for production

## Performance Optimization

### Backend

1. **Database Query Optimization**
```rust
// Use prepared statements (sqlx does this automatically)
// Add indexes for frequently queried columns
// Use EXPLAIN ANALYZE to profile queries
```

2. **Connection Pooling**
```rust
// Adjust pool size based on load
PgPoolOptions::new()
    .max_connections(10)  // Increase for production
    .acquire_timeout(Duration::from_secs(5))
```

### Frontend

1. **Code Splitting**
```typescript
// Lazy load routes
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'));
```

2. **Image Optimization**
- Serve WebP format where supported
- Use srcset for responsive images
- Lazy load below-the-fold images

3. **Bundle Size**
```bash
# Analyze bundle
npm run build -- --mode=analyze
```

## Security Checklist

- [ ] Environment variables are not committed
- [ ] HTTPS only in production
- [ ] CSRF tokens validated on all mutations
- [ ] HttpOnly cookies for sessions
- [ ] SQL injection protected (sqlx prevents this)
- [ ] S3 bucket not publicly accessible
- [ ] API rate limiting configured
- [ ] Cognito MFA encouraged for users
- [ ] Regular dependency updates

## Monitoring

### CloudWatch Metrics

Key metrics to monitor:
- Lambda invocations, errors, duration
- API Gateway 4xx/5xx errors
- DSQL query performance
- S3 request counts

### Alerts

Set up CloudWatch alarms for:
- Lambda errors > threshold
- API 5xx rate > 1%
- Database connection failures
- S3 upload failures

## Backup and Recovery

### Database Backups

Aurora DSQL automatically backs up data. To restore:
```bash
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier inventory-db \
  --db-cluster-identifier inventory-db-restored \
  --restore-to-time 2024-01-01T00:00:00Z
```

### Photo Backups

S3 versioning is enabled - recover deleted photos:
```bash
aws s3api list-object-versions \
  --bucket home-inventory-photos \
  --prefix photos/
```

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run tests and linting
4. Commit with conventional commits: `feat: add barcode scanning`
5. Push and create pull request

## Resources

- [Rust Documentation](https://doc.rust-lang.org/)
- [Axum Documentation](https://docs.rs/axum/latest/axum/)
- [React Documentation](https://react.dev/)
- [Pulumi AWS Documentation](https://www.pulumi.com/docs/clouds/aws/)
- [Aurora DSQL Guide](https://docs.aws.amazon.com/aurora-dsql/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
