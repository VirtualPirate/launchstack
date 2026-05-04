# Backend Error Standardization — Design

**Date:** 2026-05-04
**Scope:** `apps/backend` only. No frontend changes required (wire shape preserved).

## Goal

Replace ad-hoc `throw new HttpException(apiError(...), status)` patterns scattered across the backend with a single `AppError` registry of typed factory functions. Every error thrown by the backend produces a consistent response body shape that the frontend can switch on.

## Non-goals

- Changing the wire format (response body shape stays `{ code, message, details? }`).
- Frontend error-handling refactor (out of scope; frontend already consumes the same shape).
- Touching Better Auth's own error responses at `/api/auth/*` (explicitly bypassed).
- Internationalization of error messages.
- Reworking validation logic itself — only the throw-shape changes.

## Wire contract

The response body for any error originating from the backend (except `/api/auth/*`) matches the existing `ApiError` interface from `@launchstack/api-interfaces`:

```ts
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

This is identical to what the codebase emits today via the inline `apiError(code, message)` helper, so no frontend changes are needed for the migration to be safe.

## Architecture

### File layout

All new code lives in `apps/backend/src/common/errors/`:

| File | Role |
|---|---|
| `api-errors.ts` | The `ApiException` class — extends `HttpException`, carries `code: string` and optional `details`, serializes as `ApiError`. |
| `define-error.ts` | The `defineError` helper — takes a spec, returns a typed factory. Pure. |
| `application-errors.ts` | The `AppError` registry — one `defineError(...)` entry per error code. Also exports the `AppErrorCode` union (`keyof typeof AppError`). |
| `all-exceptions.filter.ts` | The global `AllExceptionsFilter` — reshapes non-`ApiException` errors into the canonical body. Bypasses `/api/auth/*`. |
| `index.ts` | Barrel re-exports. |
| `__tests__/api-errors.spec.ts` | Unit tests for `ApiException`. |
| `__tests__/define-error.spec.ts` | Unit tests for `defineError`. |
| `__tests__/all-exceptions.filter.spec.ts` | Unit tests for the filter. |

### `ApiException`

Replaces the current scaffold (whose `code: number = 0` doesn't match the wire shape).

```ts
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError } from '@launchstack/api-interfaces';

export class ApiException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: number = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    const body: ApiError = details
      ? { code, message, details }
      : { code, message };
    super(body, status);
  }
}
```

NestJS's default exception handler serializes the body passed to `super(...)`, so `ApiException` produces the correct wire shape on its own — no global filter needed for *its* throws.

### `defineError` helper

`defineError` returns a typed factory. The error code is bound at registry-seal time by walking `Object.entries(AppError)` so the registry key *is* the code — no duplication, no drift.

```ts
type ErrorSpec<A> = {
  status: number;
  message: string | ((args: A) => string);
  details?: (args: A) => Record<string, unknown>;
};

// Implementation note: defineError returns a "spec carrier" that the
// registry seals into a real factory. The seal step substitutes the
// object key in as `code`. End-users only see the resulting factory:
//   (args: A) => ApiException
```

The exported `AppError` object's value type is therefore `Record<Code, (args: A) => ApiException>`, where `A` is inferred per-entry from the `message`/`details` callbacks.

Call-site ergonomics:

```ts
throw AppError.EMAIL_NOT_VERIFIED();
throw AppError.OTP_CREATE_FAILED({ reason: error.message });
throw AppError.VALIDATION_ERROR({ details: zodFormatted });
```

Args are type-checked: pass nothing to a no-args factory and TS errors; pass extra fields and TS errors.

### Error registry

Final list — 33 codes:

| # | Code | Status | Args |
|---|---|---:|---|
| 1 | `BAD_REQUEST` | 400 | `{ message? }` |
| 2 | `UNAUTHENTICATED` | 401 | — |
| 3 | `FORBIDDEN` | 403 | `{ message? }` |
| 4 | `NOT_FOUND` | 404 | `{ message? }` |
| 5 | `INTERNAL_SERVER_ERROR` | 500 | — |
| 6 | `VALIDATION_ERROR` | 400 | `{ details }` |
| 7 | `EMAIL_NOT_VERIFIED` | 422 | — |
| 8 | `EMAIL_REQUIRED` | 400 | — |
| 9 | `OTP_TYPE_INVALID` | 400 | `{ allowed: readonly string[] }` |
| 10 | `OTP_CREATE_FAILED` | 400 | `{ reason: string }` |
| 11 | `OTP_EMAIL_SEND_FAILED` | 502 | `{ reason: string }` |
| 12 | `ORG_HEADER_REQUIRED` | 400 | — |
| 13 | `ORG_NOT_FOUND` | 404 | — |
| 14 | `ORG_FORBIDDEN` | 403 | — |
| 15 | `ORG_OWNER_CONFLICT` | 409 | — |
| 16 | `ORG_SLUG_CONFLICT` | 409 | — |
| 17 | `ORG_TRANSFER_TO_SELF` | 409 | — |
| 18 | `ORG_TRANSFER_TARGET_NOT_ADMIN` | 409 | — |
| 19 | `ORG_TRANSFER_TARGET_OWNS_ELSEWHERE` | 409 | — |
| 20 | `ORG_TRANSFER_CALLER_NOT_OWNER` | 409 | — |
| 21 | `MEMBER_NOT_FOUND` | 404 | — |
| 22 | `MEMBER_IS_OWNER` | 409 | — |
| 23 | `MEMBER_REMOVE_OWNER_FORBIDDEN` | 403 | — |
| 24 | `MEMBER_REMOVE_SELF_FORBIDDEN` | 403 | — |
| 25 | `MEMBER_INSUFFICIENT_ROLE` | 403 | — |
| 26 | `OWNER_CANNOT_LEAVE` | 409 | — |
| 27 | `INVITE_NOT_FOUND` | 404 | — |
| 28 | `INVITE_NOT_PENDING` | 410 | — |
| 29 | `INVITE_EXPIRED` | 410 | — |
| 30 | `INVITE_TARGET_IS_MEMBER` | 409 | — |
| 31 | `INVITE_EMAIL_MISMATCH` | 422 | — |
| 32 | `INVITE_RESEND_FAILED` | 502 | `{ reason: string }` |
| 33 | `INVITE_EMAIL_SEND_FAILED` | 502 | `{ reason: string }` |

Codes 1–5 are filter fallbacks; they also serve as call-site codes when nothing more specific applies.

#### Source map (where each code replaces existing throws)

- **`organizations/services/invites.service.ts`** (16 throws): `EMAIL_NOT_VERIFIED`, `INVITE_TARGET_IS_MEMBER`, `INVITE_NOT_FOUND` ×5, `INVITE_NOT_PENDING` ×3, `INVITE_RESEND_FAILED`, `INVITE_EMAIL_MISMATCH` ×2, `INVITE_EXPIRED`, `ORG_NOT_FOUND`.
- **`organizations/services/members.service.ts`** (8 throws): `MEMBER_NOT_FOUND` ×3, `MEMBER_IS_OWNER`, `MEMBER_REMOVE_OWNER_FORBIDDEN`, `MEMBER_REMOVE_SELF_FORBIDDEN`, `MEMBER_INSUFFICIENT_ROLE`, `OWNER_CANNOT_LEAVE`.
- **`organizations/services/organizations.service.ts`** (10 throws): `ORG_OWNER_CONFLICT`, `ORG_NOT_FOUND` ×3, `ORG_SLUG_CONFLICT`, `ORG_TRANSFER_TO_SELF`, `ORG_TRANSFER_TARGET_NOT_ADMIN`, `ORG_TRANSFER_TARGET_OWNS_ELSEWHERE`, `ORG_TRANSFER_CALLER_NOT_OWNER`.
- **`organizations/guards/org-context.guard.ts`** (4 throws): `ORG_HEADER_REQUIRED`, `UNAUTHENTICATED`, `ORG_NOT_FOUND`, `ORG_FORBIDDEN`.
- **`organizations/dto/zod-validation.pipe.ts`** (1 throw): `VALIDATION_ERROR`.
- **`organizations/services/invite-mailer.ts`** (1 throw): `INVITE_EMAIL_SEND_FAILED`.
- **`auth/email-otp.service.ts`** (2 throws): `OTP_CREATE_FAILED`, `OTP_EMAIL_SEND_FAILED`.
- **`auth/email-otp.controller.ts`** (2 throws): `EMAIL_REQUIRED`, `OTP_TYPE_INVALID`.

Total: 44 throw-site replacements across 8 files. Four local `function apiError(...)` helpers are deleted (in `invites.service.ts`, `members.service.ts`, `organizations.service.ts`, `org-context.guard.ts`).

### Global exception filter

**File:** `apps/backend/src/common/errors/all-exceptions.filter.ts`
**Registration:** `app.useGlobalFilters(new AllExceptionsFilter())` in `main.ts`.

**Decision tree:**

```
incoming exception
  ├─ request path starts with /api/auth/* ?
  │     → call super.catch(...) — Better Auth owns the response shape
  │
  ├─ instanceof ApiException ?
  │     → call super.catch(...) — already correct shape
  │
  ├─ instanceof HttpException (raw, not ApiException) ?
  │     → wrap into ApiException with code derived from status:
  │         400 → BAD_REQUEST,  401 → UNAUTHENTICATED,
  │         403 → FORBIDDEN,    404 → NOT_FOUND,
  │         else → BAD_REQUEST
  │     → original message preserved (deliberate throws are safe to surface)
  │
  └─ anything else (unhandled)
        → log full error with stack at error level (method + path)
        → respond as ApiException(INTERNAL_SERVER_ERROR, 'Internal server error', 500)
        → original message NEVER leaked to the client
```

**Why preserve raw-`HttpException` messages but scrub unhandled errors:** raw `HttpException`s are deliberately thrown by us or framework code we trust (e.g., NestJS's "Cannot GET /unknown-route"). Unhandled errors might leak DB schema, file paths, secrets, etc.

**Logging:** uses Nest's `Logger`. Levels:

- `error` — unhandled exceptions, with full stack and request `method`/`url`.
- `warn` — raw `HttpException`s with status ≥ 500.
- nothing — `ApiException`s (intentional and expected).

**Status-to-fallback-code map** lives as a small constant in `all-exceptions.filter.ts`, not in the registry. The fallback codes themselves are in the registry; the *mapping from status* is the filter's concern.

**Edge case:** for non-HTTP execution contexts, the filter falls through to `super.catch(...)`.

## Migration plan

Each step is independently reviewable and can be a separate commit.

1. **Foundation** — Rewrite `api-errors.ts` (string `code`, add `details`), add `define-error.ts`, replace `application-errors.ts` with the full 33-entry registry, update `index.ts`. No call-sites change yet. Add `__tests__/api-errors.spec.ts` and `__tests__/define-error.spec.ts`.
2. **Filter** — Add `all-exceptions.filter.ts` and `__tests__/all-exceptions.filter.spec.ts`. Wire `app.useGlobalFilters(...)` in `main.ts`.
3. **Validation pipe** — `zod-validation.pipe.ts` switches to `throw AppError.VALIDATION_ERROR({ details: result.error.format() })`. Existing test `zod-validation.pipe.spec.ts` continues to pass unchanged.
4. **Domain layer** — Convert in this order (smallest blast radius first):
   - `org-context.guard.ts`
   - `organizations.service.ts` (includes the four-way `ORG_TRANSFER_*` split)
   - `members.service.ts` (includes the three-way `MEMBER_*` split)
   - `invites.service.ts`
   - Each conversion deletes the local `function apiError(...)` helper and prunes now-unused `HttpException`/`HttpStatus` imports.
5. **Auth & mailer** — `email-otp.service.ts`, `email-otp.controller.ts`, `invite-mailer.ts`.
6. **Final sweep** — verify:
   - `grep -r "new HttpException" apps/backend/src` returns hits only inside `common/errors/` and tests.
   - `grep -r "function apiError" apps/backend/src` returns zero hits.
   - `pnpm test` and `pnpm lint` pass for `apps/backend`.

## Testing strategy

**Existing tests** — none need code changes. The wire shape is preserved, so any test that asserts on `getResponse().code` continues to pass. Tests that check `instanceof HttpException` continue to pass (`ApiException` extends `HttpException`).

| Existing test | Expected behavior post-migration |
|---|---|
| `zod-validation.pipe.spec.ts` | Passes unchanged (asserts `response.code === 'VALIDATION_ERROR'`). |
| `org-context.guard.spec.ts` | Passes unchanged. |
| `*.service.spec.ts` (invites/members/organizations) | Pass unchanged. |

**New tests** under `apps/backend/src/common/errors/__tests__/`:

- **`api-errors.spec.ts`** — `ApiException` serializes `{code, message}` and `{code, message, details}` correctly via `getResponse()`. Status code carried correctly.
- **`define-error.spec.ts`** — Static-message factory works with no args; function-message factory interpolates args; `details` callback is invoked; produced `code` matches the registry key for a sample sealed registry.
- **`all-exceptions.filter.spec.ts`** — One test per branch:
  - `/api/auth/foo` → filter delegates to `super.catch` (verified via spy or by checking response untouched).
  - `ApiException` → response `{code, message}` and status preserved.
  - Raw `HttpException(400, 'msg')` → wrapped as `{code: 'BAD_REQUEST', message: 'msg'}`.
  - `new Error('boom with secret')` → `{code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error'}`. Asserts `'secret'` does not appear in the response body. Asserts logger called with stack.

## Risk & rollback

- Wire shape is preserved, so frontend doesn't break. If the filter misbehaves, removing the `useGlobalFilters` line in `main.ts` reverts to NestJS defaults — `ApiException` still works fine on its own.
- The Better Auth bypass is the highest-risk piece. Tests must explicitly cover that `/api/auth/*` requests are not reshaped.
- The `defineError` registry-sealing step uses runtime key iteration; an integration smoke test (one ApiException-producing endpoint hit end-to-end) confirms correct wiring at startup.

## Out of scope (deliberately)

- Frontend error-handling improvements that could now switch on `error.code` more uniformly. Once this lands, the frontend can adopt a typed `AppErrorCode` import from a shared location — but that's a follow-up.
- An i18n layer over messages.
- Distinguishing client-facing vs. internal-only error details.
- Replacing Better Auth's error responses to match this shape.
