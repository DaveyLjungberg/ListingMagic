# Google OAuth Setup Guide

## Supabase Configuration

### 1. Enable Google OAuth in Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list and click to configure
4. Toggle **Enable Google provider** to ON

### 2. Get Google OAuth Credentials

#### Option A: Use Supabase's Built-in Google OAuth (Easiest)
Supabase provides Google OAuth credentials for development. Just enable the provider and you're done!

#### Option B: Create Your Own Google OAuth App (Production)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - App name: **QuickList**
   - User support email: Your email
   - Developer contact: Your email
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: **QuickList Production**
   - Authorized redirect URIs:
     ```
     https://vbfwcemtkgymygccgffl.supabase.co/auth/v1/callback
     ```
7. Copy **Client ID** and **Client Secret**

### 3. Configure Supabase with Google Credentials

In Supabase Dashboard → Authentication → Providers → Google:
- Paste **Client ID**
- Paste **Client Secret**
- Click **Save**

### 4. Configure Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://listing-magic.vercel.app`
- **Redirect URLs** (add these):
  ```
  https://listing-magic.vercel.app/auth/callback
  http://localhost:3000/auth/callback
  ```

### 5. Test OAuth Flow

1. Go to your login page: https://listing-magic.vercel.app/auth/login
2. Click **Continue with Google**
3. You should be redirected to Google login
4. After successful login, redirected back to `/auth/callback`
5. Then redirected to `/dashboard/generate` (or your `redirectTo` parameter)

## Local Development

For local testing:
1. Use `http://localhost:3000` as your base URL
2. Ensure `http://localhost:3000/auth/callback` is in Supabase redirect URLs
3. Test with: `http://localhost:3000/auth/login`

## Troubleshooting

### "Invalid redirect URI"
- Ensure the exact callback URL is added in both Google Console and Supabase
- Format: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`

### "OAuth flow cancelled"
- Check that Site URL in Supabase matches your deployment URL
- Verify redirect URLs list includes your callback route

### "Session not found"
- Verify `/auth/callback/page.jsx` exists and is properly configured
- Check that Supabase client is initialized correctly
- Ensure cookies are enabled in browser

### Session not persisting
- Check that `getSession()` is called in callback handler
- Verify Supabase Auth is configured with correct settings
- Check browser console for errors

## Environment Variables

Ensure these are set in your deployment (Vercel):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vbfwcemtkgymygccgffl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

No additional env vars needed for OAuth - Supabase handles it!

## Apple OAuth (Future)

To enable Apple OAuth:
1. Similar process in Supabase Dashboard
2. Need Apple Developer account ($99/year)
3. Configure in https://developer.apple.com
4. Add callback URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`

## Security Notes

- OAuth tokens are managed by Supabase - you don't handle them directly
- Sessions are stored in Supabase Auth cookies (httpOnly, secure)
- "Remember Me" uses localStorage for preference only (not credentials)
- Session validation happens on every protected route
- Admin routes check email address for authorization

## Testing Checklist

- [ ] Google OAuth button appears on login page
- [ ] Click redirects to Google login
- [ ] Google login succeeds and redirects back
- [ ] Callback handler validates session
- [ ] User redirects to intended destination
- [ ] Session persists across page refreshes
- [ ] "Remember Me" respects user preference
- [ ] Session tracking logs the login
- [ ] Admin dashboard shows session count

## Reference

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)

