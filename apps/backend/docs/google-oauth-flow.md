# Sign-Up / Sign-In with Google OAuth

Base URL: `http://localhost:3000/api/auth`

## Prerequisites

1. Create a Google OAuth app in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Set application type to "Web application"
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret to your `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
   ```
5. Restart the backend server

---

## Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  Initiate│────────▶│  Google  │────────▶│ Callback │────────▶│ Session  │
│  Sign-In │  302    │  Consent │  302    │ Exchange │  set    │ Active   │
│          │redirect │  Screen  │redirect │  Code    │ cookie  │          │
└──────────┘         └──────────┘         └──────────┘         └──────────┘
```

The entire flow is browser-based (redirect chain). The backend handles the OAuth
handshake automatically. If the user's Google email matches an existing account,
the accounts are linked automatically.

---

## Step 1: Initiate Google Sign-In

Redirect the user's browser to:

```
GET /api/auth/sign-in/social?provider=google&callbackURL=/dashboard
```

**Query parameters:**

| Parameter             | Required | Description                                        |
|-----------------------|----------|----------------------------------------------------|
| `provider`            | Yes      | Must be `google`                                   |
| `callbackURL`         | No       | URL to redirect to after successful sign-in        |
| `errorCallbackURL`    | No       | URL to redirect to on error                        |
| `newUserCallbackURL`  | No       | URL to redirect to if the user is new              |

The server responds with a **302 redirect** to Google's consent screen.

---

## Step 2: Google Consent

The user sees Google's consent screen and chooses their Google account. This step
is entirely on Google's side. After consent, Google redirects back to:

```
GET /api/auth/callback/google?code=...&state=...
```

---

## Step 3: Callback (Automatic)

The backend automatically:

1. Exchanges the authorization code for tokens with Google
2. Fetches the user's profile (name, email, profile image)
3. Creates a new user OR links to an existing user with the same email
4. Encrypts OAuth tokens (access token, refresh token) before storing
5. Creates a session
6. Sets the `better-auth.session_token` cookie
7. Redirects to `callbackURL` (or the frontend root)

---

## Account Linking Behavior

Google is configured as a **trusted provider**. This means:

| Scenario | What happens |
|----------|-------------|
| New email (no existing account) | New user + account created |
| Existing email+password account, email verified | Google account linked to existing user |
| Existing email+password account, email NOT verified | Google account linked (Google is trusted) |
| Same Google account signed in again | Existing session refreshed |

After linking, the user can sign in with either email+password or Google.

---

## Verifying the Session

After the OAuth flow completes, the session cookie is set. Use it to access protected endpoints:

```
GET /api/auth/get-session
Cookie: better-auth.session_token=...
```

**Response (200):**
```json
{
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "john@gmail.com",
    "emailVerified": true,
    "image": "https://lh3.googleusercontent.com/...",
    "createdAt": "2026-04-11T00:00:00.000Z",
    "updatedAt": "2026-04-11T00:00:00.000Z"
  },
  "session": {
    "id": "sess_xyz",
    "token": "...",
    "expiresAt": "2026-04-18T00:00:00.000Z"
  }
}
```

---

## Frontend Integration

From a React frontend using the Better Auth client:

```typescript
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});

// Sign in with Google
const signInWithGoogle = async () => {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
};
```

This triggers the same redirect chain described above.

---

## Error Cases

| Scenario                     | What happens                                             |
|------------------------------|----------------------------------------------------------|
| User denies Google consent   | Redirected to `errorCallbackURL` (or frontend root)      |
| Invalid client ID/secret     | Google shows an error page (never reaches callback)      |
| Redirect URI mismatch        | Google shows "redirect_uri_mismatch" error               |
| Google env vars not set      | `/api/auth/sign-in/social?provider=google` returns error |

**Common setup issue:** If you see `redirect_uri_mismatch`, verify that the redirect URI
in Google Cloud Console exactly matches `http://localhost:3000/api/auth/callback/google`
(or your production URL). Trailing slashes matter.

---

## cURL Examples

Google OAuth requires browser redirects, so cURL can only initiate the flow:

**Get the Google consent URL:**
```bash
curl -v http://localhost:3000/api/auth/sign-in/social?provider=google 2>&1 | grep -i location
```

This returns a `302` with a `Location` header pointing to Google's consent screen.
Open that URL in a browser to complete the flow.

**Check session after OAuth (with cookies from browser):**
```bash
curl http://localhost:3000/api/auth/get-session \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN_HERE"
```

---

## Token Encryption

OAuth access tokens and refresh tokens from Google are encrypted at rest using
AES-256-GCM before being stored in the `account` table. The encryption key is
derived from `BETTER_AUTH_SECRET`.

To read tokens for external API calls (e.g., Google APIs), use the decrypt utility:

```typescript
import { deriveKey, decrypt } from './auth/crypto';

const key = deriveKey(process.env.BETTER_AUTH_SECRET);
const plainAccessToken = decrypt(account.accessToken, key);
```

**Important:** Do not change `BETTER_AUTH_SECRET` after OAuth tokens are stored.
Changing the secret will make existing encrypted tokens unreadable.
