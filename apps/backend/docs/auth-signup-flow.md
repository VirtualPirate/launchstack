# Sign-Up with Email OTP Verification

Base URL: `http://localhost:3000/api/auth`

## Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Sign Up │────────▶│  Receive │────────▶│  Verify  │
│  (email  │  auto   │   OTP    │  user   │  Email   │
│   + pw)  │  sends  │  (inbox) │  submits│  (OTP)   │
└──────────┘  OTP    └──────────┘  code   └──────────┘
```

The password is provided at sign-up time. Because `sendVerificationOnSignUp` is enabled,
an OTP is automatically sent to the email. The user then verifies their email with
that OTP as a second step.

---

## Step 1: Sign Up

Creates the user account and automatically sends a 6-digit OTP to the provided email.

```
POST /api/auth/sign-up/email
Content-Type: application/json
```

**Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "your-password-here"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "emailVerified": false,
    "image": null,
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

Note: the response sets a `better-auth.session_token` cookie. Include cookies in subsequent requests.

At this point, `emailVerified` is `false` and an OTP has been sent to the email.

---

## Step 2: Verify Email with OTP

Submit the 6-digit code the user received in their inbox.

```
POST /api/auth/email-otp/verify-email
Content-Type: application/json
```

**Request body:**
```json
{
  "email": "john@example.com",
  "otp": "483921"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "abc123",
    "email": "john@example.com",
    "emailVerified": true
  }
}
```

The user's email is now verified. The session from Step 1 remains valid.

---

## Resending the OTP

If the user didn't receive the code or it expired (5 minutes), resend it:

```
POST /api/auth/email-otp/send-verification-otp
Content-Type: application/json
```

**Request body:**
```json
{
  "email": "john@example.com",
  "type": "email-verification"
}
```

**OTP types:**
| Type                  | When to use                          |
|-----------------------|--------------------------------------|
| `email-verification`  | Verify email after sign-up           |
| `sign-in`             | Passwordless sign-in via OTP         |
| `password-reset`      | Reset a forgotten password           |

---

## Error Cases

| Scenario               | Status | Error                          |
|------------------------|--------|--------------------------------|
| Email already taken    | 422    | User with this email exists    |
| Wrong OTP              | 400    | Invalid OTP                    |
| Expired OTP            | 400    | OTP expired (after 5 minutes)  |
| Missing required field | 400    | Validation error               |

---

## cURL Examples

**Sign up:**
```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"name":"John Doe","email":"john@example.com","password":"mypassword123"}'
```

**Verify email:**
```bash
curl -X POST http://localhost:3000/api/auth/email-otp/verify-email \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"john@example.com","otp":"483921"}'
```

**Resend OTP:**
```bash
curl -X POST http://localhost:3000/api/auth/email-otp/send-verification-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","type":"email-verification"}'
```
