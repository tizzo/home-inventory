# Google OAuth2 Setup Guide

To enable "Login with Google", you need to create a project in the Google Cloud Console and generate OAuth credentials.

## Step 1: Create a Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **"New Project"**.
3. Name it `home-inventory-dev` (or similar) and click **Create**.

## Step 2: Configure OAuth Consent Screen
1. In the side menu, go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (unless you have a Google Workspace organization) and click **Create**.
3. **App Information**:
   - App name: `Home Inventory`
   - User support email: Select your email
4. **Developer Contact Information**: Enter your email.
5. Click **Save and Continue**.
6. **Scopes**: Click **Add or Remove Scopes**.
   - Select `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
   - Click **Update** then **Save and Continue**.
7. **Test Users**:
   - Click **Add Users** and add your own Google email address (important for testing while the app is in "Testing" mode).
   - Click **Save and Continue**.

## Step 3: Create Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. **Application type**: Select **Web application**.
4. **Name**: `Home Inventory Local`
5. **Authorized redirect URIs**:
   - Click **+ Add URI**.
   - Enter: `http://localhost:3000/api/auth/callback`
   - *Note: Ensure this matches exactly what we will use in the backend.*
6. Click **Create**.

## Step 4: Save Credentials
You will see a modal with "Your Client ID" and "Your Client Secret".
Copy these values into your `backend/.env` file:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_secret_here
GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/callback
```
