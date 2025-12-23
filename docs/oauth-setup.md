# OAuth Setup Guide

This guide explains how to configure OAuth authentication for both user login (Google/GitHub) and email integration (Gmail/Outlook).

## Overview

The platform supports two types of OAuth flows:

1. **User Login OAuth**: Login with Google or GitHub account
2. **Email Knowledge Base OAuth**: Connect Gmail or Outlook to import emails

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Google Cloud Console account (for Google OAuth)
- GitHub Developer account (for GitHub OAuth)
- Microsoft Azure account (for Outlook OAuth)

## 1. User Login OAuth Setup

### Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - App name: Your app name
   - Support email: Your email
   - Authorized domains: Your domain (or localhost for development)
6. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: Digital Twin Login
   - Authorized redirect URIs: `http://localhost:3001/api/oauth/auth/google/callback`
7. Copy **Client ID** and **Client Secret**

Add to `.env`:
```bash
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

### GitHub OAuth Configuration

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the details:
   - Application name: Your app name
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3001/api/oauth/auth/github/callback`
4. Click **Register application**
5. Copy **Client ID**
6. Generate a new **Client Secret** and copy it

Add to `.env`:
```bash
GITHUB_OAUTH_CLIENT_ID=your-github-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-client-secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
FRONTEND_URL=http://localhost:3000
```

## 2. Email Knowledge Base OAuth Setup

### Gmail OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Use the same project or create a new one
3. Enable **Gmail API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: Digital Twin Email Integration
   - Authorized redirect URIs: `http://localhost:3001/api/email/auth/gmail/callback`
6. Copy **Client ID** and **Client Secret**

Add to `.env`:
```bash
GMAIL_CLIENT_ID=your-gmail-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=http://localhost:3001/api/email/auth/gmail/callback
```

### Outlook OAuth Configuration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the details:
   - Name: Digital Twin Email Integration
   - Supported account types: Accounts in any organizational directory and personal Microsoft accounts
   - Redirect URI: Web - `http://localhost:3001/api/email/auth/outlook/callback`
5. Copy **Application (client) ID**
6. Go to **Certificates & secrets** → **New client secret**
7. Copy the **secret value** (not the ID)
8. Go to **API permissions** → **Add a permission** → **Microsoft Graph**
9. Add these permissions:
   - `Mail.Read` (Delegated)
   - `offline_access` (Delegated)
   - `User.Read` (Delegated)

Add to `.env`:
```bash
OUTLOOK_CLIENT_ID=your-outlook-client-id
OUTLOOK_CLIENT_SECRET=your-outlook-client-secret
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/email/auth/outlook/callback
```

## 3. Other Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://digitaltwin_user:digitaltwin_pass@localhost:5432/digitaltwin

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Encryption for email credentials
ENCRYPTION_KEY=your-encryption-key-min-32-characters-change-in-production

# Server
PORT=3001
NODE_ENV=development

# Frontend
REACT_APP_URL=http://localhost:3000
```

## 4. Testing OAuth Flows

### Test User Login OAuth

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:3000/login`
4. Click "Google" or "GitHub" button
5. Complete OAuth flow in popup
6. Should redirect to dashboard on success

### Test Email Integration OAuth

1. Login to the application
2. Navigate to Dashboard → Email tab
3. Click "Connect Gmail" or "Connect Outlook"
4. Complete OAuth flow in popup
5. Should show connected status with email address

## Troubleshooting

### "Redirect URI mismatch" error

- Check that redirect URI in OAuth provider settings matches exactly with the one in `.env`
- Make sure to include protocol (`http://` or `https://`)
- No trailing slashes

### "Invalid client" error

- Verify Client ID and Client Secret are correct
- Check that OAuth app is not in test mode (should be published for production)

### "Popup blocked" error

- Allow popups for localhost in browser settings
- Alternatively, use IMAP connection for email (no OAuth required)

### OAuth callback not working

- Check that backend is running on port 3001
- Verify FRONTEND_URL is set correctly in `.env`
- Check browser console for errors

## Security Considerations

### Production Deployment

When deploying to production:

1. Update all redirect URIs to use your production domain
2. Use HTTPS for all URLs
3. Generate strong secrets for JWT_SECRET and ENCRYPTION_KEY
4. Enable security features in OAuth provider settings
5. Review and minimize OAuth scopes/permissions
6. Set up CORS properly in backend

### Example Production Configuration

```bash
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/google/callback
GITHUB_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/github/callback
GMAIL_REDIRECT_URI=https://yourdomain.com/api/email/auth/gmail/callback
OUTLOOK_REDIRECT_URI=https://yourdomain.com/api/email/auth/outlook/callback
FRONTEND_URL=https://yourdomain.com
```

## API Endpoints Reference

### User Login OAuth
- `GET /api/oauth/auth/google` - Initiate Google login
- `GET /api/oauth/auth/google/callback` - Google callback
- `GET /api/oauth/auth/github` - Initiate GitHub login
- `GET /api/oauth/auth/github/callback` - GitHub callback

### Email Integration OAuth
- `GET /api/email/auth/gmail` - Get Gmail auth URL (requires auth)
- `GET /api/email/auth/gmail/callback` - Gmail callback
- `GET /api/email/auth/outlook` - Get Outlook auth URL (requires auth)
- `GET /api/email/auth/outlook/callback` - Outlook callback

## Database Schema

OAuth user information is stored in the `users` table:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  oauth_provider VARCHAR(50), -- 'google' | 'github' | null
  oauth_id VARCHAR(255),      -- Provider's user ID
  avatar_url TEXT,            -- Profile picture URL
  ...
);
```

Email OAuth credentials are encrypted and stored in `email_credentials` table.

## Further Reading

- [Passport.js Documentation](http://www.passportjs.org/)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/auth-v2-user)
