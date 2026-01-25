# Authentication Architecture

**Last Updated**: January 2025

## Overview

This application uses **Google OAuth 2.0** for authentication with persistent session storage in PostgreSQL.

## Quick Reference

### Where is the code?

| Component | File Path | Key Lines |
|-----------|-----------|-----------|
| OAuth routes | `backend/src/routes/auth.rs` | All |
| Auth middleware | `backend/src/middleware/auth.rs` | All |
| OAuth client setup | `backend/src/app.rs` | 98-123 |
| Frontend auth hook | `frontend/src/hooks/useAuth.ts` | All |
| Login UI component | `frontend/src/components/LoginButton.tsx` | All |
| Protected routes | `frontend/src/components/ProtectedRoute.tsx` | All |
| API client config | `frontend/src/api/client.ts` | All |
| Users table migration | `backend/migrations/20240101000001_create_users.sql` | All |

### Environment Variables Required

```bash
# Backend (.env)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_secret_here
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/callback
APP_BASE_URL=http://localhost:5173
```

See `backend/GOOGLE_AUTH_SETUP.md` for how to obtain Google OAuth credentials.

## Authentication Flow

### 1. Login Initiation
- User clicks "Sign in with Google" button (`LoginButton.tsx:82`)
- Button links to `/api/auth/login`
- Backend generates CSRF token and stores in session (`auth.rs:46-61`)
- Backend redirects to Google OAuth authorization endpoint
- Scopes requested: `email` and `profile`

### 2. OAuth Callback
- Google redirects back to `/api/auth/callback` with authorization code (`auth.rs:63-142`)
- Backend verifies CSRF token (security measure against CSRF attacks)
- Backend exchanges authorization code for access token
- Backend calls Google's userinfo API: `https://www.googleapis.com/oauth2/v2/userinfo`
- Backend "upserts" user in PostgreSQL (creates new or updates existing)
- User session is stored in database
- Backend redirects to frontend (`APP_BASE_URL`)

### 3. Session Management
- Sessions stored in PostgreSQL using `tower-sessions` library
- Session data includes: `user_id`, `email`, `name`, `picture`
- Sessions expire after 1 day of inactivity
- Cookies use `Lax` SameSite policy for OAuth redirect compatibility
- Secure flag set to `false` in dev, should be `true` in production

### 4. Frontend Auth State
- `useAuth` hook fetches `/api/auth/me` on app load (`useAuth.ts:8-14`)
- User state managed by React Query with cache key `['auth', 'user']`
- API client configured with `withCredentials: true` to send cookies (`client.ts:5`)
- Protected routes check auth state, redirect to login if needed (`ProtectedRoute.tsx`)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/login` | Initiates OAuth flow, redirects to Google |
| `GET` | `/api/auth/callback` | Handles OAuth callback from Google |
| `GET` | `/api/auth/me` | Returns current user session (or 401) |
| `POST` | `/api/auth/logout` | Clears session |

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Sessions Table
- Automatically created and managed by `tower-sessions-sqlx-store`
- Stores serialized session data with expiration timestamps

## Common Issues and Fixes

### Issue: Login redirects to 404

**Symptoms**: After clicking login or on 401 error, user sees 404 page

**Cause**: Incorrect redirect URL (using `/auth/login` instead of `/api/auth/login`)

**Fix**: Ensure all login redirects use `/api/auth/login`:
- In `api/client.ts:26` - error interceptor redirect
- In `LoginButton.tsx:82` - login button href

### Issue: Cookies not being sent with requests

**Symptoms**: User must log in on every page refresh, `/api/auth/me` returns 401

**Cause**: Missing `withCredentials: true` configuration

**Fix**:
- `frontend/src/api/client.ts:5` - API client must have `withCredentials: true`
- `frontend/src/hooks/useAuth.ts:6` - Axios must have `withCredentials: true`

### Issue: CSRF token validation fails

**Symptoms**: Callback returns "Invalid CSRF token" error

**Cause**: Session not persisting between login and callback requests

**Fix**:
- Check PostgreSQL is running
- Verify session store configuration in `backend/src/app.rs`
- Check cookie settings (domain, path, SameSite)

### Issue: Google OAuth consent screen shows error

**Symptoms**: "Error 400: redirect_uri_mismatch"

**Cause**: Redirect URI in code doesn't match Google Console configuration

**Fix**:
- Verify `GOOGLE_REDIRECT_URL` in `.env` exactly matches URI in Google Console
- Common mistake: `http://localhost:3000/api/auth/callback` vs `http://localhost:3000/auth/callback`

### Issue: Session expires too quickly

**Symptoms**: Users logged out after short time

**Fix**: Adjust session expiration in `backend/src/app.rs`:
```rust
.expiry(Expiry::OnInactivity(time::Duration::days(1)))
```

## Security Considerations

### CSRF Protection
- Random CSRF token generated on login initiation
- Token stored in session and verified on callback
- Prevents unauthorized OAuth flows

### Cookie Security
- **Development**: `secure: false` (HTTP allowed for localhost)
- **Production**: Must set `secure: true` (HTTPS only)
- `SameSite: Lax` allows OAuth redirects while providing CSRF protection
- `HttpOnly: true` prevents JavaScript access to session cookie

### Session Storage
- Sessions stored server-side in PostgreSQL (not in client)
- Only session ID sent to client as cookie
- User data cannot be tampered with client-side

## Testing Checklist

When testing authentication:

- [ ] New user can sign in with Google
- [ ] Existing user can sign in (email/name updated if changed)
- [ ] Session persists across page refreshes
- [ ] Protected routes redirect to login when not authenticated
- [ ] User can log out successfully
- [ ] 401 errors redirect to login page
- [ ] Login button shows user avatar/initials when authenticated
- [ ] User dropdown shows correct name and email

## Migration from Cognito to Google OAuth

The app previously used AWS Cognito. Migration details:

- Migration applied: `backend/migrations/20240105000000_replace_cognito_with_google.sql`
- Changed column: `cognito_sub` → `google_id`
- No data migration needed (fresh Google OAuth setup)

## Related Documentation

- [backend/GOOGLE_AUTH_SETUP.md](../backend/GOOGLE_AUTH_SETUP.md) - How to configure Google OAuth credentials
- [QUICK_START.md](../QUICK_START.md) - Complete local setup guide
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development workflows
