<!-- This file is yours. Requestly will not overwrite it.
     Use it for project-specific instructions and context that agents
     working in this folder should read alongside AGENTS.md. -->

# Project Context

## What this project is for

Requestly collections for the LaunchStack NestJS API (`apps/backend`). Start it with `pnpm dev:backend`; `{{apiBaseUrl}}` is `http://localhost:3000`. Every route lives under `/api/...` except the demo `GET /` and `GET /users`.

| Collection | Routes | Backend source |
|---|---|---|
| Auth | Better Auth `/api/auth/*`: email + password sign-up/in, get-session, sign-out, email OTP (send, verify, sign-in, reset password), Google sign-in (only when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set). Also the custom `POST /api/email-otp/send-verification`. | `src/auth/auth.config.ts`, `src/auth/email-otp.controller.ts` |
| App | `GET /`, `GET /users`, `GET /api/health` (readiness: 503 when Postgres or Temporal is down), `GET /api/health/live` (liveness) | `src/app.controller.ts`, `src/health/health.controller.ts` |
| Organizations (+ Members) | `/api/organizations`, `/api/organizations/me`, `/api/organizations/current[...]`, `/api/organizations/current/members[...]` | `src/organizations/controllers/` |
| Invites | `/api/organizations/current/invites[...]`, `/api/invites/{me,accept,decline,preview}` | `src/organizations/controllers/invites.controller.ts` |
| Internal | `POST /api/_internal/queue/noop` (returns 202 + `{ jobId }`) | `src/queue/noop.controller.ts` |

Request bodies follow the Zod schemas in `packages/api-interfaces/src/requests/`. Update the request here when a schema or route changes.

## Environment

`environments/LaunchStack-Dev.json`:

| Variable | Value |
|---|---|
| `apiBaseUrl` | `http://localhost:3000` |
| `email`, `password` | Your local test account |
| `authToken` | Better Auth session token (see Auth below) |
| `organizationId` | uuid from List My Organizations |
| `memberId`, `newOwnerUserId` | From List Members |
| `inviteId`, `inviteToken` | From List Org Invites / the invite email |
| `internalToken` | Backend `INTERNAL_API_TOKEN` |

## Auth & conventions

- Protected requests set `__auth.json` to `bearer_token` with `{{authToken}}`. Requests use `no_auth` when they are `@AllowAnonymous()`, run before a session exists (Sign Up, Sign In, the OTP routes), or authenticate with `X-Internal-Token` instead.
- LaunchStack's Better Auth has no `bearer()` plugin, so the server ignores the `Authorization` header. The session comes from the `better-auth.session_token` cookie that Sign In sets. Header-only auth needs `bearer()` added to `auth.config.ts`.
- Routes decorated with `@RequireOrgRole` send `X-Organization-Id: {{organizationId}}`. The header must be a uuid, and the caller must be a member of that org. Owner-only routes: delete org, transfer ownership, change a member's role. Admin routes: update org, remove a member, all org invite routes.
- Password sign-in fails until the email is verified. Order: Sign Up, then Verify Email OTP with the emailed code, then Sign In.
- Send Verification OTP `type`: `email-verification`, `sign-in` (before Sign In with OTP), or `forget-password` (before Reset Password).

## Things agents should not change

- Never commit real emails, passwords, tokens or ids to `environments/*.json`. Leave the committed values empty and fill them in locally.
- Do not hand-edit `id` fields or the `__requestly.json` version (see AGENTS.md).
- Add new endpoints as request directories here, not as `.http` files.
