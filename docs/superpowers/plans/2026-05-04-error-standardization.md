# Backend Error Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc `throw new HttpException(apiError(...), status)` patterns across `apps/backend` with a single typed `AppError` registry, plus a global exception filter that ensures every error response (except `/api/auth/*`) matches `{ code, message, details? }`.

**Architecture:** A small `ApiException` class extending `HttpException` carries the canonical wire shape. A `defineError` helper plus `sealRegistry` builds typed factory functions whose arg shapes are inferred from each spec. A global `AllExceptionsFilter` reshapes any non-`ApiException` errors so the wire contract is uniform.

**Tech Stack:** NestJS 11, Jest 30, TypeScript 5.9, `@nestjs/common`, `@nestjs/core`.

**Spec:** `docs/superpowers/specs/2026-05-04-error-standardization-design.md`

---

## File Structure

**Created/rewritten:**

| Path | Role |
|---|---|
| `apps/backend/src/common/errors/api-errors.ts` | `ApiException` class (rewrites scaffold). |
| `apps/backend/src/common/errors/define-error.ts` | `defineError`, `sealRegistry`, types. |
| `apps/backend/src/common/errors/application-errors.ts` | `AppError` registry (rewrites scaffold). |
| `apps/backend/src/common/errors/all-exceptions.filter.ts` | Global filter. |
| `apps/backend/src/common/errors/index.ts` | Barrel exports (already exists, may need updates). |
| `apps/backend/src/common/errors/__tests__/api-errors.spec.ts` | New. |
| `apps/backend/src/common/errors/__tests__/define-error.spec.ts` | New. |
| `apps/backend/src/common/errors/__tests__/all-exceptions.filter.spec.ts` | New. |

**Modified:**

| Path | Change |
|---|---|
| `apps/backend/src/main.ts` | Wire `useGlobalFilters`. |
| `apps/backend/src/organizations/dto/zod-validation.pipe.ts` | Use `AppError.VALIDATION_ERROR`. |
| `apps/backend/src/organizations/guards/org-context.guard.ts` | Use AppError, drop local `apiError`. |
| `apps/backend/src/organizations/services/organizations.service.ts` | Use AppError + 4-way `ORG_TRANSFER_*` split. |
| `apps/backend/src/organizations/services/members.service.ts` | Use AppError + 3-way `MEMBER_*` split. |
| `apps/backend/src/organizations/services/invites.service.ts` | Use AppError. |
| `apps/backend/src/organizations/services/invite-mailer.ts` | Use AppError. |
| `apps/backend/src/auth/email-otp.service.ts` | Use AppError. |
| `apps/backend/src/auth/email-otp.controller.ts` | Use AppError. |

---

## Task 1: `ApiException` foundation

**Files:**
- Create: `apps/backend/src/common/errors/__tests__/api-errors.spec.ts`
- Modify: `apps/backend/src/common/errors/api-errors.ts` (rewrite — currently a scaffold with numeric `code`)

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/common/errors/__tests__/api-errors.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../api-errors';

describe('ApiException', () => {
  it('serializes as { code, message } when no details', () => {
    const exc = new ApiException('SAMPLE', 'Sample message', HttpStatus.BAD_REQUEST);
    expect(exc.getResponse()).toEqual({ code: 'SAMPLE', message: 'Sample message' });
    expect(exc.getStatus()).toBe(400);
  });

  it('serializes as { code, message, details } when details provided', () => {
    const exc = new ApiException(
      'WITH_DETAILS',
      'has details',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field: 'email' },
    );
    expect(exc.getResponse()).toEqual({
      code: 'WITH_DETAILS',
      message: 'has details',
      details: { field: 'email' },
    });
    expect(exc.getStatus()).toBe(422);
  });

  it('exposes code and details as readable properties', () => {
    const exc = new ApiException('CODE_X', 'msg', 400, { a: 1 });
    expect(exc.code).toBe('CODE_X');
    expect(exc.details).toEqual({ a: 1 });
  });

  it('defaults status to 400 when omitted', () => {
    const exc = new ApiException('DEFAULT_STATUS', 'msg');
    expect(exc.getStatus()).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/api-errors.spec.ts`

Expected: FAIL (current `ApiException` has numeric `code`, doesn't carry `details`, response body shape is wrong).

- [ ] **Step 3: Replace `api-errors.ts` with the new implementation**

Overwrite `apps/backend/src/common/errors/api-errors.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/api-errors.spec.ts`

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/common/errors/api-errors.ts apps/backend/src/common/errors/__tests__/api-errors.spec.ts
git commit -m "feat(errors): ApiException carrying string code and details"
```

---

## Task 2: `defineError` helper

**Files:**
- Create: `apps/backend/src/common/errors/__tests__/define-error.spec.ts`
- Create: `apps/backend/src/common/errors/define-error.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/common/errors/__tests__/define-error.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import { defineError, sealRegistry } from '../define-error';
import { ApiException } from '../api-errors';

describe('defineError + sealRegistry', () => {
  const Sealed = sealRegistry({
    SAMPLE_NO_ARGS: defineError({
      status: HttpStatus.BAD_REQUEST,
      message: 'static message',
    }),
    SAMPLE_DYNAMIC: defineError<{ reason: string }>({
      status: HttpStatus.BAD_GATEWAY,
      message: ({ reason }) => `failed: ${reason}`,
      details: ({ reason }) => ({ reason }),
    }),
    SAMPLE_DETAILS_ONLY: defineError<{ details: unknown }>({
      status: HttpStatus.BAD_REQUEST,
      message: 'validation failed',
      details: ({ details }) => ({ details }),
    }),
  });

  it('produces an ApiException whose code matches the registry key', () => {
    const exc = Sealed.SAMPLE_NO_ARGS();
    expect(exc).toBeInstanceOf(ApiException);
    expect(exc.code).toBe('SAMPLE_NO_ARGS');
    expect(exc.getStatus()).toBe(400);
    expect(exc.getResponse()).toEqual({
      code: 'SAMPLE_NO_ARGS',
      message: 'static message',
    });
  });

  it('interpolates dynamic message and details from args', () => {
    const exc = Sealed.SAMPLE_DYNAMIC({ reason: 'timeout' });
    expect(exc.code).toBe('SAMPLE_DYNAMIC');
    expect(exc.getStatus()).toBe(502);
    expect(exc.getResponse()).toEqual({
      code: 'SAMPLE_DYNAMIC',
      message: 'failed: timeout',
      details: { reason: 'timeout' },
    });
  });

  it('passes through details with a static message', () => {
    const exc = Sealed.SAMPLE_DETAILS_ONLY({ details: { field: 'email' } });
    expect(exc.code).toBe('SAMPLE_DETAILS_ONLY');
    expect(exc.getResponse()).toEqual({
      code: 'SAMPLE_DETAILS_ONLY',
      message: 'validation failed',
      details: { details: { field: 'email' } },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/define-error.spec.ts`

Expected: FAIL (`defineError` and `sealRegistry` don't exist).

- [ ] **Step 3: Create the helper**

Create `apps/backend/src/common/errors/define-error.ts`:

```ts
import { ApiException } from './api-errors';

export type ErrorSpec<A> = {
  status: number;
  message: string | ((args: A) => string);
  details?: (args: A) => Record<string, unknown>;
};

const SPEC: unique symbol = Symbol('ErrorSpec');

export type SpecCarrier<A> = { readonly [SPEC]: ErrorSpec<A> };

export function defineError<A = void>(spec: ErrorSpec<A>): SpecCarrier<A> {
  return { [SPEC]: spec };
}

type Factory<C extends SpecCarrier<unknown>> =
  C extends SpecCarrier<infer A>
    ? [A] extends [void]
      ? () => ApiException
      : (args: A) => ApiException
    : never;

export type SealedRegistry<R extends Record<string, SpecCarrier<unknown>>> = {
  [K in keyof R]: Factory<R[K]>;
};

export function sealRegistry<R extends Record<string, SpecCarrier<unknown>>>(
  carriers: R,
): SealedRegistry<R> {
  const out: Record<string, (args?: unknown) => ApiException> = {};
  for (const code of Object.keys(carriers)) {
    const spec = (carriers[code] as SpecCarrier<unknown>)[SPEC];
    out[code] = (args?: unknown) => {
      const message =
        typeof spec.message === 'function'
          ? (spec.message as (a: unknown) => string)(args)
          : spec.message;
      const details = spec.details ? spec.details(args) : undefined;
      return new ApiException(code, message, spec.status, details);
    };
  }
  return out as SealedRegistry<R>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/define-error.spec.ts`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/common/errors/define-error.ts apps/backend/src/common/errors/__tests__/define-error.spec.ts
git commit -m "feat(errors): defineError helper and sealRegistry"
```

---

## Task 3: `AppError` registry

**Files:**
- Modify: `apps/backend/src/common/errors/application-errors.ts` (rewrite — currently has 2 placeholder entries)
- Modify: `apps/backend/src/common/errors/index.ts` (verify `AppErrorCode` re-exported)

- [ ] **Step 1: Write the failing test**

Append to `apps/backend/src/common/errors/__tests__/define-error.spec.ts` (new describe block — keeps registry tests close to the helper tests):

```ts
import { AppError, type AppErrorCode } from '../application-errors';

describe('AppError registry', () => {
  it('exposes a no-args factory for EMAIL_NOT_VERIFIED', () => {
    const exc = AppError.EMAIL_NOT_VERIFIED();
    expect(exc.code).toBe('EMAIL_NOT_VERIFIED');
    expect(exc.getStatus()).toBe(422);
    expect(exc.getResponse()).toEqual({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email before handling invites',
    });
  });

  it('exposes a dynamic factory for OTP_CREATE_FAILED', () => {
    const exc = AppError.OTP_CREATE_FAILED({ reason: 'rate limited' });
    expect(exc.code).toBe('OTP_CREATE_FAILED');
    expect(exc.getStatus()).toBe(400);
    expect(exc.getResponse()).toEqual({
      code: 'OTP_CREATE_FAILED',
      message: 'rate limited',
      details: { reason: 'rate limited' },
    });
  });

  it('exposes a details-carrying factory for VALIDATION_ERROR', () => {
    const exc = AppError.VALIDATION_ERROR({ details: { field: 'email' } });
    expect(exc.code).toBe('VALIDATION_ERROR');
    expect(exc.getStatus()).toBe(400);
    expect((exc.getResponse() as { details: unknown }).details).toEqual({
      field: 'email',
    });
  });

  it('exposes a four-way ORG_TRANSFER split', () => {
    expect(AppError.ORG_TRANSFER_TO_SELF().code).toBe('ORG_TRANSFER_TO_SELF');
    expect(AppError.ORG_TRANSFER_TARGET_NOT_ADMIN().code).toBe(
      'ORG_TRANSFER_TARGET_NOT_ADMIN',
    );
    expect(AppError.ORG_TRANSFER_TARGET_OWNS_ELSEWHERE().code).toBe(
      'ORG_TRANSFER_TARGET_OWNS_ELSEWHERE',
    );
    expect(AppError.ORG_TRANSFER_CALLER_NOT_OWNER().code).toBe(
      'ORG_TRANSFER_CALLER_NOT_OWNER',
    );
  });

  it('exposes a three-way MEMBER_FORBIDDEN split', () => {
    expect(AppError.MEMBER_REMOVE_OWNER_FORBIDDEN().code).toBe(
      'MEMBER_REMOVE_OWNER_FORBIDDEN',
    );
    expect(AppError.MEMBER_REMOVE_SELF_FORBIDDEN().code).toBe(
      'MEMBER_REMOVE_SELF_FORBIDDEN',
    );
    expect(AppError.MEMBER_INSUFFICIENT_ROLE().code).toBe('MEMBER_INSUFFICIENT_ROLE');
  });

  it('exports an AppErrorCode union containing all registry keys', () => {
    const codes: AppErrorCode[] = [
      'BAD_REQUEST',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'INTERNAL_SERVER_ERROR',
      'VALIDATION_ERROR',
      'EMAIL_NOT_VERIFIED',
      'EMAIL_REQUIRED',
      'OTP_TYPE_INVALID',
      'OTP_CREATE_FAILED',
      'OTP_EMAIL_SEND_FAILED',
      'ORG_HEADER_REQUIRED',
      'ORG_NOT_FOUND',
      'ORG_FORBIDDEN',
      'ORG_OWNER_CONFLICT',
      'ORG_SLUG_CONFLICT',
      'ORG_TRANSFER_TO_SELF',
      'ORG_TRANSFER_TARGET_NOT_ADMIN',
      'ORG_TRANSFER_TARGET_OWNS_ELSEWHERE',
      'ORG_TRANSFER_CALLER_NOT_OWNER',
      'MEMBER_NOT_FOUND',
      'MEMBER_IS_OWNER',
      'MEMBER_REMOVE_OWNER_FORBIDDEN',
      'MEMBER_REMOVE_SELF_FORBIDDEN',
      'MEMBER_INSUFFICIENT_ROLE',
      'OWNER_CANNOT_LEAVE',
      'INVITE_NOT_FOUND',
      'INVITE_NOT_PENDING',
      'INVITE_EXPIRED',
      'INVITE_TARGET_IS_MEMBER',
      'INVITE_EMAIL_MISMATCH',
      'INVITE_RESEND_FAILED',
      'INVITE_EMAIL_SEND_FAILED',
    ];
    for (const code of codes) {
      expect(typeof AppError[code]).toBe('function');
    }
    expect(codes).toHaveLength(33);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/define-error.spec.ts`

Expected: FAIL (registry has only `BAD_REQUEST` + `INTERNAL_SERVER_ERROR` placeholders).

- [ ] **Step 3: Replace `application-errors.ts` with the full registry**

Overwrite `apps/backend/src/common/errors/application-errors.ts`:

```ts
import { HttpStatus } from '@nestjs/common';
import { defineError, sealRegistry } from './define-error';

export const AppError = sealRegistry({
  // --- Filter fallbacks (also usable directly) ---
  BAD_REQUEST: defineError<{ message?: string } | void>({
    status: HttpStatus.BAD_REQUEST,
    message: (args) => args?.message ?? 'Bad request',
  }),
  UNAUTHENTICATED: defineError({
    status: HttpStatus.UNAUTHORIZED,
    message: 'Authentication required',
  }),
  FORBIDDEN: defineError<{ message?: string } | void>({
    status: HttpStatus.FORBIDDEN,
    message: (args) => args?.message ?? 'Forbidden',
  }),
  NOT_FOUND: defineError<{ message?: string } | void>({
    status: HttpStatus.NOT_FOUND,
    message: (args) => args?.message ?? 'Not found',
  }),
  INTERNAL_SERVER_ERROR: defineError({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  }),

  // --- Validation ---
  VALIDATION_ERROR: defineError<{ details: unknown }>({
    status: HttpStatus.BAD_REQUEST,
    message: 'Request validation failed',
    details: ({ details }) => ({ details }),
  }),

  // --- Auth / OTP ---
  EMAIL_NOT_VERIFIED: defineError({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Verify your email before handling invites',
  }),
  EMAIL_REQUIRED: defineError({
    status: HttpStatus.BAD_REQUEST,
    message: 'Email is required',
  }),
  OTP_TYPE_INVALID: defineError<{ allowed: readonly string[] }>({
    status: HttpStatus.BAD_REQUEST,
    message: ({ allowed }) =>
      `Invalid OTP type. Must be one of: ${allowed.join(', ')}`,
    details: ({ allowed }) => ({ allowed: [...allowed] }),
  }),
  OTP_CREATE_FAILED: defineError<{ reason: string }>({
    status: HttpStatus.BAD_REQUEST,
    message: ({ reason }) => reason,
    details: ({ reason }) => ({ reason }),
  }),
  OTP_EMAIL_SEND_FAILED: defineError<{ reason: string }>({
    status: HttpStatus.BAD_GATEWAY,
    message: ({ reason }) => `Failed to send verification email: ${reason}`,
    details: ({ reason }) => ({ reason }),
  }),

  // --- Org context / guard ---
  ORG_HEADER_REQUIRED: defineError({
    status: HttpStatus.BAD_REQUEST,
    message: 'Missing or malformed X-Organization-Id header',
  }),
  ORG_NOT_FOUND: defineError({
    status: HttpStatus.NOT_FOUND,
    message: 'Organization not found',
  }),
  ORG_FORBIDDEN: defineError({
    status: HttpStatus.FORBIDDEN,
    message: 'Insufficient organization role',
  }),

  // --- Org lifecycle ---
  ORG_OWNER_CONFLICT: defineError({
    status: HttpStatus.CONFLICT,
    message: 'You already own an organization',
  }),
  ORG_SLUG_CONFLICT: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Slug already in use',
  }),

  // --- Org transfer (4-way split) ---
  ORG_TRANSFER_TO_SELF: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Cannot transfer to yourself',
  }),
  ORG_TRANSFER_TARGET_NOT_ADMIN: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Target must be an existing admin of this organization',
  }),
  ORG_TRANSFER_TARGET_OWNS_ELSEWHERE: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Target already owns another organization',
  }),
  ORG_TRANSFER_CALLER_NOT_OWNER: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Caller is not the current owner',
  }),

  // --- Members ---
  MEMBER_NOT_FOUND: defineError({
    status: HttpStatus.NOT_FOUND,
    message: 'Member not found',
  }),
  MEMBER_IS_OWNER: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Use transfer-ownership to change the owner role',
  }),
  MEMBER_REMOVE_OWNER_FORBIDDEN: defineError({
    status: HttpStatus.FORBIDDEN,
    message: 'Cannot remove the owner — use transfer-ownership or delete',
  }),
  MEMBER_REMOVE_SELF_FORBIDDEN: defineError({
    status: HttpStatus.FORBIDDEN,
    message: 'Use the leave endpoint to remove yourself',
  }),
  MEMBER_INSUFFICIENT_ROLE: defineError({
    status: HttpStatus.FORBIDDEN,
    message: 'Insufficient role',
  }),
  OWNER_CANNOT_LEAVE: defineError({
    status: HttpStatus.CONFLICT,
    message: 'Owner must transfer ownership or delete the organization',
  }),

  // --- Invites ---
  INVITE_NOT_FOUND: defineError({
    status: HttpStatus.NOT_FOUND,
    message: 'Invite not found',
  }),
  INVITE_NOT_PENDING: defineError({
    status: HttpStatus.GONE,
    message: 'Invite is not pending',
  }),
  INVITE_EXPIRED: defineError({
    status: HttpStatus.GONE,
    message: 'Invite is expired',
  }),
  INVITE_TARGET_IS_MEMBER: defineError({
    status: HttpStatus.CONFLICT,
    message: 'User is already a member',
  }),
  INVITE_EMAIL_MISMATCH: defineError({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Invite was sent to a different email',
  }),
  INVITE_RESEND_FAILED: defineError<{ reason: string }>({
    status: HttpStatus.BAD_GATEWAY,
    message: ({ reason }) =>
      `Failed to resend invite email. Previous invite link remains valid. ${reason}`,
    details: ({ reason }) => ({ reason }),
  }),
  INVITE_EMAIL_SEND_FAILED: defineError<{ reason: string }>({
    status: HttpStatus.BAD_GATEWAY,
    message: ({ reason }) => `Failed to send invite email: ${reason}`,
    details: ({ reason }) => ({ reason }),
  }),
});

export type AppErrorCode = keyof typeof AppError;
```

- [ ] **Step 4: Confirm `index.ts` re-exports the registry**

Read `apps/backend/src/common/errors/index.ts`. It should already contain:

```ts
export * from './api-errors';
export * from './application-errors';
```

If `define-error.ts` types are needed elsewhere, also add:

```ts
export * from './define-error';
```

(Optional — only if a downstream file imports `defineError` directly. For the current scope, only `application-errors.ts` uses it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/define-error.spec.ts`

Expected: PASS (all `AppError registry` cases plus the original `defineError + sealRegistry` cases).

Also run the full common/errors suite to confirm nothing else broke:
Run: `cd apps/backend && pnpm jest src/common/errors`

Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/common/errors/application-errors.ts apps/backend/src/common/errors/__tests__/define-error.spec.ts
git commit -m "feat(errors): full AppError registry with 33 entries"
```

---

## Task 4: Global `AllExceptionsFilter`

**Files:**
- Create: `apps/backend/src/common/errors/__tests__/all-exceptions.filter.spec.ts`
- Create: `apps/backend/src/common/errors/all-exceptions.filter.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/common/errors/__tests__/all-exceptions.filter.spec.ts`:

```ts
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ApiException } from '../api-errors';
import { AllExceptionsFilter } from '../all-exceptions.filter';

function makeHost(req: { url?: string; method?: string } = {}): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({} as never),
    switchToWs: () => ({} as never),
    getType: () => 'http' as const,
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let superCatch: jest.SpyInstance;

  beforeEach(() => {
    superCatch = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delegates to super for /api/auth/* paths regardless of exception type', () => {
    const filter = new AllExceptionsFilter();
    const exc = new Error('better-auth-internal');
    filter.catch(exc, makeHost({ url: '/api/auth/sign-in' }));
    expect(superCatch).toHaveBeenCalledTimes(1);
    expect(superCatch.mock.calls[0][0]).toBe(exc);
  });

  it('passes ApiException through unchanged', () => {
    const filter = new AllExceptionsFilter();
    const exc = new ApiException('FOO', 'foo msg', HttpStatus.BAD_REQUEST);
    filter.catch(exc, makeHost({ url: '/api/users' }));
    expect(superCatch).toHaveBeenCalledWith(exc, expect.anything());
  });

  it('wraps raw HttpException into ApiException with code derived from status', () => {
    const filter = new AllExceptionsFilter();
    const raw = new HttpException('cannot GET', HttpStatus.NOT_FOUND);
    filter.catch(raw, makeHost({ url: '/api/missing' }));
    const passed = superCatch.mock.calls[0][0] as ApiException;
    expect(passed).toBeInstanceOf(ApiException);
    expect(passed.code).toBe('NOT_FOUND');
    expect(passed.getStatus()).toBe(404);
    expect(passed.message).toBe('cannot GET');
  });

  it('falls back to BAD_REQUEST for raw HttpException with status outside the map', () => {
    const filter = new AllExceptionsFilter();
    const raw = new HttpException('teapot', 418);
    filter.catch(raw, makeHost({ url: '/x' }));
    const passed = superCatch.mock.calls[0][0] as ApiException;
    expect(passed.code).toBe('BAD_REQUEST');
    expect(passed.getStatus()).toBe(418);
    expect(passed.message).toBe('teapot');
  });

  it('replaces unhandled errors with INTERNAL_SERVER_ERROR and never leaks the original message', () => {
    const filter = new AllExceptionsFilter();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const err = new Error('SECRET_VALUE_DO_NOT_LEAK');
    filter.catch(err, makeHost({ url: '/api/orgs', method: 'POST' }));
    const passed = superCatch.mock.calls[0][0] as ApiException;
    expect(passed.code).toBe('INTERNAL_SERVER_ERROR');
    expect(passed.message).toBe('Internal server error');
    expect(passed.getStatus()).toBe(500);
    const responseBody = JSON.stringify(passed.getResponse());
    expect(responseBody).not.toContain('SECRET_VALUE_DO_NOT_LEAK');
    expect(errorSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/all-exceptions.filter.spec.ts`

Expected: FAIL (`all-exceptions.filter` module does not exist).

- [ ] **Step 3: Implement the filter**

Create `apps/backend/src/common/errors/all-exceptions.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ApiException } from './api-errors';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return super.catch(exception, host);
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ url?: string; method?: string }>();
    const url = request?.url ?? '';

    if (url.startsWith('/api/auth/')) {
      return super.catch(exception, host);
    }

    if (exception instanceof ApiException) {
      return super.catch(exception, host);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_TO_CODE[status] ?? 'BAD_REQUEST';
      const message = exception.message;
      if (status >= 500) {
        this.logger.warn(
          `Raw HttpException ${status} on ${request?.method ?? '?'} ${url}: ${message}`,
        );
      }
      return super.catch(new ApiException(code, message, status), host);
    }

    const err = exception as Error;
    this.logger.error(
      `Unhandled exception on ${request?.method ?? '?'} ${url}: ${err?.message ?? exception}`,
      err?.stack,
    );
    return super.catch(
      new ApiException(
        'INTERNAL_SERVER_ERROR',
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      host,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm jest src/common/errors/__tests__/all-exceptions.filter.spec.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/common/errors/all-exceptions.filter.ts apps/backend/src/common/errors/__tests__/all-exceptions.filter.spec.ts
git commit -m "feat(errors): AllExceptionsFilter with auth bypass and unhandled-error scrubbing"
```

---

## Task 5: Wire global filter in `main.ts`

**Files:**
- Modify: `apps/backend/src/main.ts`

- [ ] **Step 1: Update `main.ts`**

Replace `apps/backend/src/main.ts` with:

```ts
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({
    origin: true, // Accept requests from everywhere
    credentials: true,
  });
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 2: Type-check the file**

Run: `cd apps/backend && pnpm tsc --noEmit -p tsconfig.json`

Expected: success (no type errors).

- [ ] **Step 3: Build to confirm wiring**

Run: `cd apps/backend && pnpm build`

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/main.ts
git commit -m "feat(errors): register AllExceptionsFilter globally"
```

---

## Task 6: Migrate `zod-validation.pipe.ts`

**Files:**
- Modify: `apps/backend/src/organizations/dto/zod-validation.pipe.ts`

- [ ] **Step 1: Confirm baseline**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/zod-validation.pipe.spec.ts`

Expected: PASS (test asserts `response.code === 'VALIDATION_ERROR'`, which the new shape preserves).

- [ ] **Step 2: Replace the pipe**

Overwrite `apps/backend/src/organizations/dto/zod-validation.pipe.ts`:

```ts
import { PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { AppError } from '../../common/errors';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw AppError.VALIDATION_ERROR({ details: result.error.format() });
    }
    return result.data;
  }
}
```

- [ ] **Step 3: Re-run the existing test**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/zod-validation.pipe.spec.ts`

Expected: PASS (shape unchanged, `details` still populated).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/organizations/dto/zod-validation.pipe.ts
git commit -m "refactor(errors): zod pipe uses AppError.VALIDATION_ERROR"
```

---

## Task 7: Migrate `org-context.guard.ts`

**Files:**
- Modify: `apps/backend/src/organizations/guards/org-context.guard.ts`

- [ ] **Step 1: Confirm baseline**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/org-context.guard.spec.ts`

Expected: PASS (existing tests assert on `status` only; shape preserved).

- [ ] **Step 2: Replace the guard**

Overwrite `apps/backend/src/organizations/guards/org-context.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '@launchstack/api-interfaces';
import {
  OrgRoleLevel,
  REQUIRE_ORG_ROLE_KEY,
} from '../decorators/require-org-role.decorator';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import { AppError } from '../../common/errors';

const ROLE_RANK: Record<OrganizationRole, number> = {
  viewer: 1,
  admin: 2,
  owner: 3,
};

const LEVEL_MIN_RANK: Record<OrgRoleLevel, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membersRepo: OrganizationMembersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const level = this.reflector.getAllAndOverride<OrgRoleLevel | undefined>(
      REQUIRE_ORG_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!level) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      session?: { user?: { id?: string } };
      orgMembership?: {
        organizationId: string;
        userId: string;
        role: OrganizationRole;
      };
    }>();

    const headerValue = request.headers['x-organization-id'];
    const organizationId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    if (!organizationId || typeof organizationId !== 'string') {
      throw AppError.ORG_HEADER_REQUIRED();
    }

    const userId = request.session?.user?.id;
    if (!userId) {
      throw AppError.UNAUTHENTICATED();
    }

    const membership = await this.membersRepo.findByOrgAndUser(
      organizationId,
      userId,
    );
    if (!membership) {
      throw AppError.ORG_NOT_FOUND();
    }

    if (ROLE_RANK[membership.role] < LEVEL_MIN_RANK[level]) {
      throw AppError.ORG_FORBIDDEN();
    }

    request.orgMembership = {
      organizationId,
      userId,
      role: membership.role,
    };
    return true;
  }
}
```

- [ ] **Step 3: Update the test file to drop now-unused `HttpException` reference**

Modify `apps/backend/src/organizations/__tests__/org-context.guard.spec.ts` — the line `void HttpException;` near the bottom can stay (it imports/voids `HttpException` to suppress unused-import warnings, and the test file still imports it). **Leave the test file unchanged** — `ApiException extends HttpException`, so `rejects.toMatchObject({ status: 4xx })` still works.

- [ ] **Step 4: Run guard tests**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/org-context.guard.spec.ts`

Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/organizations/guards/org-context.guard.ts
git commit -m "refactor(errors): OrgContextGuard uses AppError"
```

---

## Task 8: Migrate `organizations.service.ts`

**Files:**
- Modify: `apps/backend/src/organizations/services/organizations.service.ts`

This includes the four-way `ORG_TRANSFER_*` split.

- [ ] **Step 1: Confirm baseline**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/organizations.service.spec.ts`

Expected: PASS.

- [ ] **Step 2: Replace throws with `AppError`**

Overwrite `apps/backend/src/organizations/services/organizations.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  MyOrganization,
  Organization,
  OrganizationRole,
} from '@launchstack/api-interfaces';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import type {
  OrganizationMemberSelect,
  OrganizationSelect,
} from '../../databases/pg-drizzle/types';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import { AppError } from '../../common/errors';

type Db = PostgresJsDatabase<Record<string, unknown>>;

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  return `${base || 'org'}-${suffix}`;
}

export function serializeOrganization(row: OrganizationSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly orgs: OrganizationsRepository,
    private readonly members: OrganizationMembersRepository,
    @Inject(DRIZZLE_DB) private readonly db: Db,
  ) {}

  async createOrganization(
    ownerUserId: string,
    input: { name: string },
  ): Promise<{
    organization: Organization;
    membership: OrganizationMemberSelect;
  }> {
    const existing = await this.orgs.findByOwnerId(ownerUserId);
    if (existing) {
      throw AppError.ORG_OWNER_CONFLICT();
    }

    const result = await this.db.transaction(async (tx) => {
      let slug = buildSlug(input.name);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await this.orgs.findBySlug(slug, tx);
        if (!clash) break;
        slug = buildSlug(input.name);
      }

      const org = await this.orgs.create(
        { name: input.name, slug, ownerId: ownerUserId },
        tx,
      );
      const membership = await this.members.create(
        { organizationId: org.id, userId: ownerUserId, role: 'owner' },
        tx,
      );
      return { org, membership };
    });

    return {
      organization: serializeOrganization(result.org),
      membership: result.membership,
    };
  }

  async listMyOrganizations(userId: string): Promise<MyOrganization[]> {
    const rows = await this.members.listByUser(userId);
    return rows.map((r) => ({
      organization: serializeOrganization(r.organization),
      role: r.member.role,
    }));
  }

  async getCurrentOrganization(
    organizationId: string,
    role: OrganizationRole,
  ): Promise<{ organization: Organization; role: OrganizationRole }> {
    const row = await this.orgs.findById(organizationId);
    if (!row) {
      throw AppError.ORG_NOT_FOUND();
    }
    return { organization: serializeOrganization(row), role };
  }

  async updateOrganization(
    organizationId: string,
    patch: { name?: string; slug?: string },
  ): Promise<Organization> {
    if (patch.slug) {
      const clash = await this.orgs.findBySlug(patch.slug);
      if (clash && clash.id !== organizationId) {
        throw AppError.ORG_SLUG_CONFLICT();
      }
    }
    const updated = await this.orgs.update(organizationId, patch);
    if (!updated) {
      throw AppError.ORG_NOT_FOUND();
    }
    return serializeOrganization(updated);
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.orgs.delete(organizationId);
  }

  async transferOwnership(input: {
    organizationId: string;
    currentOwnerUserId: string;
    newOwnerUserId: string;
  }): Promise<Organization> {
    if (input.currentOwnerUserId === input.newOwnerUserId) {
      throw AppError.ORG_TRANSFER_TO_SELF();
    }

    return await this.db.transaction(async (tx) => {
      const target = await this.members.findByOrgAndUser(
        input.organizationId,
        input.newOwnerUserId,
        tx,
      );
      if (!target || target.role !== 'admin') {
        throw AppError.ORG_TRANSFER_TARGET_NOT_ADMIN();
      }

      const targetOwnsElsewhere = await this.orgs.findByOwnerId(
        input.newOwnerUserId,
        tx,
      );
      if (targetOwnsElsewhere) {
        throw AppError.ORG_TRANSFER_TARGET_OWNS_ELSEWHERE();
      }

      const currentOwnerMembership = await this.members.findByOrgAndUser(
        input.organizationId,
        input.currentOwnerUserId,
        tx,
      );
      if (!currentOwnerMembership || currentOwnerMembership.role !== 'owner') {
        throw AppError.ORG_TRANSFER_CALLER_NOT_OWNER();
      }

      const updatedOrg = await this.orgs.setOwner(
        input.organizationId,
        input.newOwnerUserId,
        tx,
      );
      if (!updatedOrg) {
        throw AppError.ORG_NOT_FOUND();
      }

      await this.members.updateRole(target.id, 'owner', tx);
      await this.members.updateRole(currentOwnerMembership.id, 'admin', tx);

      return serializeOrganization(updatedOrg);
    });
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/organizations.service.spec.ts`

Expected: PASS (existing tests check `status: 409` / `status: 404`, which all four `ORG_TRANSFER_*` codes preserve).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/organizations/services/organizations.service.ts
git commit -m "refactor(errors): OrganizationsService uses AppError with 4-way ORG_TRANSFER split"
```

---

## Task 9: Migrate `members.service.ts`

**Files:**
- Modify: `apps/backend/src/organizations/services/members.service.ts`

Includes the three-way `MEMBER_FORBIDDEN` split.

- [ ] **Step 1: Confirm baseline**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/members.service.spec.ts`

Expected: PASS.

- [ ] **Step 2: Replace throws with `AppError`**

Overwrite `apps/backend/src/organizations/services/members.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  OrganizationMember,
  OrganizationRole,
} from '@launchstack/api-interfaces';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import type { OrgMembershipContext } from '../decorators/org-membership.decorator';
import type { MemberRowWithUser } from '../repositories/members.repository';
import { AppError } from '../../common/errors';

function serializeMember(row: MemberRowWithUser): OrganizationMember {
  return {
    id: row.member.id,
    organizationId: row.member.organizationId,
    userId: row.member.userId,
    role: row.member.role,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image ?? null,
    },
    createdAt: row.member.createdAt.toISOString(),
  };
}

@Injectable()
export class MembersService {
  constructor(private readonly members: OrganizationMembersRepository) {}

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await this.members.listByOrg(organizationId);
    return rows.map(serializeMember);
  }

  async updateMemberRole(input: {
    organizationId: string;
    memberId: string;
    newRole: Exclude<OrganizationRole, 'owner'>;
  }): Promise<OrganizationMember> {
    const rows = await this.members.listByOrg(input.organizationId);
    const target = rows.find((r) => r.member.id === input.memberId);
    if (!target) {
      throw AppError.MEMBER_NOT_FOUND();
    }
    if (target.member.role === 'owner') {
      throw AppError.MEMBER_IS_OWNER();
    }
    const updated = await this.members.updateRole(
      input.memberId,
      input.newRole,
    );
    if (!updated) {
      throw AppError.MEMBER_NOT_FOUND();
    }
    return serializeMember({ member: updated, user: target.user });
  }

  async removeMember(input: {
    organizationId: string;
    callerMembership: OrgMembershipContext;
    targetMemberId: string;
  }): Promise<void> {
    const rows = await this.members.listByOrg(input.organizationId);
    const target = rows.find((r) => r.member.id === input.targetMemberId);
    if (!target) {
      throw AppError.MEMBER_NOT_FOUND();
    }

    const callerRole = input.callerMembership.role;

    if (target.member.role === 'owner') {
      throw AppError.MEMBER_REMOVE_OWNER_FORBIDDEN();
    }

    if (target.member.userId === input.callerMembership.userId) {
      throw AppError.MEMBER_REMOVE_SELF_FORBIDDEN();
    }

    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw AppError.MEMBER_INSUFFICIENT_ROLE();
    }

    await this.members.delete(input.targetMemberId);
  }

  async leaveOrganization(input: {
    organizationId: string;
    callerMembership: OrgMembershipContext;
  }): Promise<void> {
    if (input.callerMembership.role === 'owner') {
      throw AppError.OWNER_CANNOT_LEAVE();
    }
    await this.members.deleteByOrgAndUser(
      input.organizationId,
      input.callerMembership.userId,
    );
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/members.service.spec.ts`

Expected: PASS (tests check `status: 403`/`409`, all three new codes preserve them).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/organizations/services/members.service.ts
git commit -m "refactor(errors): MembersService uses AppError with 3-way MEMBER split"
```

---

## Task 10: Migrate `invites.service.ts`

**Files:**
- Modify: `apps/backend/src/organizations/services/invites.service.ts`

Sixteen throws in this file.

- [ ] **Step 1: Confirm baseline**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/invites.service.spec.ts`

Expected: PASS.

- [ ] **Step 2: Replace throws with `AppError`**

Overwrite `apps/backend/src/organizations/services/invites.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type {
  InvitePreview,
  InviteRole,
  InviteStatus,
  Organization,
  OrganizationInvite,
} from '@launchstack/api-interfaces';
import { DRIZZLE_DB } from '../../databases/pg-drizzle';
import { user } from '../../databases/pg-drizzle/auth-schema';
import type { OrganizationMemberSelect } from '../../databases/pg-drizzle/types';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { OrganizationMembersRepository } from '../repositories/members.repository';
import {
  InviteWithRefs,
  OrganizationInvitesRepository,
} from '../repositories/invites.repository';
import { generateInviteToken, hashInviteToken } from '../tokens';
import { serializeOrganization } from './organizations.service';
import { InviteMailer } from './invite-mailer';
import { AppError } from '../../common/errors';

type Db = PostgresJsDatabase<Record<string, unknown>>;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function serializeInvite(row: InviteWithRefs): OrganizationInvite {
  return {
    id: row.invite.id,
    organizationId: row.invite.organizationId,
    email: row.invite.email,
    role: row.invite.role,
    status: row.invite.status,
    expiresAt: row.invite.expiresAt.toISOString(),
    createdAt: row.invite.createdAt.toISOString(),
    invitedBy: row.invitedBy ?? null,
    acceptedBy: null,
    acceptedAt: row.invite.acceptedAt
      ? row.invite.acceptedAt.toISOString()
      : null,
  };
}

interface CallerContext {
  userId: string;
  email: string;
  emailVerified: boolean;
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly invites: OrganizationInvitesRepository,
    private readonly members: OrganizationMembersRepository,
    private readonly orgs: OrganizationsRepository,
    @Inject(DRIZZLE_DB) private readonly db: Db,
    private readonly mailer: InviteMailer,
    private readonly config: ConfigService,
  ) {}

  /** Hook-point for tests to stub user lookups (used by previewInvite). */
  lookupUser: (
    userId: string,
  ) => Promise<{ id: string; name: string; email: string } | null> = async (
    userId,
  ) => {
    const [row] = await this.db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  };

  private buildAcceptUrl(rawToken: string): string {
    const base = this.config.getOrThrow<string>('FRONTEND_URL');
    const url = new URL('/accept-invite', base);
    url.searchParams.set('token', rawToken);
    return url.toString();
  }

  private requireVerifiedCaller(caller: CallerContext) {
    if (!caller.emailVerified) {
      throw AppError.EMAIL_NOT_VERIFIED();
    }
  }

  async createInvite(input: {
    organizationId: string;
    inviterUserId: string;
    email: string;
    role: InviteRole;
  }): Promise<OrganizationInvite> {
    const email = input.email.trim().toLowerCase();

    const existingMembers = await this.members.listByOrg(input.organizationId);
    if (existingMembers.some((m) => m.user.email.toLowerCase() === email)) {
      throw AppError.INVITE_TARGET_IS_MEMBER();
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const created = await this.db.transaction(async (tx) => {
      const existing = await this.invites.findPendingByOrgAndEmail(
        input.organizationId,
        email,
        tx,
      );
      if (existing) {
        await this.invites.updateStatus(existing.id, 'expired', tx);
      }
      return this.invites.create(
        {
          organizationId: input.organizationId,
          email,
          role: input.role,
          tokenHash,
          status: 'pending',
          expiresAt,
          invitedByUserId: input.inviterUserId,
        },
        tx,
      );
    });

    const org = await this.orgs.findById(input.organizationId);
    const inviter = await this.lookupUser(input.inviterUserId);
    await this.mailer.sendInviteEmail({
      to: email,
      organizationName: org?.name ?? 'your organization',
      inviterName: inviter?.name ?? 'A teammate',
      role: input.role,
      acceptUrl: this.buildAcceptUrl(rawToken),
      expiresInDays: 7,
    });

    return serializeInvite({
      invite: created,
      organization: org!,
      invitedBy: inviter,
    });
  }

  async listOrganizationInvites(
    organizationId: string,
    status: InviteStatus | 'all',
  ): Promise<OrganizationInvite[]> {
    const rows = await this.invites.listByOrg(organizationId, { status });
    return rows.map(serializeInvite);
  }

  async listMyInvites(email: string): Promise<OrganizationInvite[]> {
    const rows = await this.invites.listByEmail(email.trim().toLowerCase(), {
      status: 'pending',
      notExpiredAfter: new Date(),
    });
    return rows.map(serializeInvite);
  }

  async revokeInvite(input: {
    organizationId: string;
    inviteId: string;
  }): Promise<void> {
    const row = await this.invites.findById(input.inviteId);
    if (!row || row.organizationId !== input.organizationId) {
      throw AppError.INVITE_NOT_FOUND();
    }
    if (row.status !== 'pending') return;
    await this.invites.updateStatus(row.id, 'revoked');
  }

  async resendInvite(input: {
    organizationId: string;
    inviteId: string;
  }): Promise<OrganizationInvite> {
    const row = await this.invites.findById(input.inviteId);
    if (!row || row.organizationId !== input.organizationId) {
      throw AppError.INVITE_NOT_FOUND();
    }
    if (row.status !== 'pending') {
      throw AppError.INVITE_NOT_PENDING();
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const previousToken = {
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
    };

    const updated = await this.invites.rotateToken(row.id, {
      tokenHash,
      expiresAt,
    });
    const org = await this.orgs.findById(input.organizationId);
    const inviter = row.invitedByUserId
      ? await this.lookupUser(row.invitedByUserId)
      : null;
    try {
      await this.mailer.sendInviteEmail({
        to: row.email,
        organizationName: org?.name ?? 'your organization',
        inviterName: inviter?.name ?? 'A teammate',
        role: row.role,
        acceptUrl: this.buildAcceptUrl(rawToken),
        expiresInDays: 7,
      });
    } catch (err) {
      await this.invites.rotateToken(row.id, previousToken);
      const reason = err instanceof Error ? err.message : 'unknown error';
      throw AppError.INVITE_RESEND_FAILED({ reason });
    }

    return serializeInvite({
      invite: updated!,
      organization: org!,
      invitedBy: inviter,
    });
  }

  async previewInvite(rawToken: string): Promise<InvitePreview> {
    const row = await this.invites.findByTokenHash(hashInviteToken(rawToken));
    if (!row) {
      throw AppError.INVITE_NOT_FOUND();
    }
    if (row.status !== 'pending' || row.expiresAt <= new Date()) {
      throw AppError.INVITE_NOT_PENDING();
    }
    const org = await this.orgs.findById(row.organizationId);
    const inviter = row.invitedByUserId
      ? await this.lookupUser(row.invitedByUserId)
      : null;
    return {
      organizationName: org?.name ?? 'Organization',
      inviterName: inviter?.name ?? null,
      invitedEmail: row.email,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  private async resolveInvite(identifier: {
    token?: string;
    inviteId?: string;
  }) {
    if (identifier.token) {
      const row = await this.invites.findByTokenHash(
        hashInviteToken(identifier.token),
      );
      return row;
    }
    if (identifier.inviteId) {
      return this.invites.findById(identifier.inviteId);
    }
    return null;
  }

  async acceptInvite(input: {
    caller: CallerContext;
    token?: string;
    inviteId?: string;
  }): Promise<{
    organization: Organization;
    membership: OrganizationMemberSelect;
  }> {
    this.requireVerifiedCaller(input.caller);

    const row = await this.resolveInvite({
      token: input.token,
      inviteId: input.inviteId,
    });
    if (!row) {
      throw AppError.INVITE_NOT_FOUND();
    }
    if (row.email.toLowerCase() !== input.caller.email.toLowerCase()) {
      throw AppError.INVITE_EMAIL_MISMATCH();
    }
    if (row.status !== 'pending') {
      throw AppError.INVITE_NOT_PENDING();
    }
    if (row.expiresAt <= new Date()) {
      throw AppError.INVITE_EXPIRED();
    }

    const result = await this.db.transaction(async (tx) => {
      const existing = await this.members.findByOrgAndUser(
        row.organizationId,
        input.caller.userId,
        tx,
      );
      const membership =
        existing ??
        (await this.members.create(
          {
            organizationId: row.organizationId,
            userId: input.caller.userId,
            role: row.role,
          },
          tx,
        ));
      await this.invites.markAccepted(
        row.id,
        input.caller.userId,
        new Date(),
        tx,
      );
      return { membership };
    });

    const org = await this.orgs.findById(row.organizationId);
    if (!org) {
      throw AppError.ORG_NOT_FOUND();
    }
    return {
      organization: serializeOrganization(org),
      membership: result.membership,
    };
  }

  async declineInvite(input: {
    caller: CallerContext;
    token?: string;
    inviteId?: string;
  }): Promise<void> {
    this.requireVerifiedCaller(input.caller);
    const row = await this.resolveInvite({
      token: input.token,
      inviteId: input.inviteId,
    });
    if (!row) {
      throw AppError.INVITE_NOT_FOUND();
    }
    if (row.email.toLowerCase() !== input.caller.email.toLowerCase()) {
      throw AppError.INVITE_EMAIL_MISMATCH();
    }
    if (row.status !== 'pending') return;
    await this.invites.updateStatus(row.id, 'revoked');
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/backend && pnpm jest src/organizations/__tests__/invites.service.spec.ts`

Expected: PASS (existing tests check on status only — `409`, `410`, `422`, `502`, `404` — all preserved by the new codes).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/organizations/services/invites.service.ts
git commit -m "refactor(errors): InvitesService uses AppError"
```

---

## Task 11: Migrate auth + mailer files

**Files:**
- Modify: `apps/backend/src/organizations/services/invite-mailer.ts`
- Modify: `apps/backend/src/auth/email-otp.service.ts`
- Modify: `apps/backend/src/auth/email-otp.controller.ts`

- [ ] **Step 1: Replace `invite-mailer.ts`**

Overwrite `apps/backend/src/organizations/services/invite-mailer.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { renderInviteEmail } from '../../emails/render-email';
import { AppError } from '../../common/errors';

export interface SendInviteEmailInput {
  to: string;
  organizationName: string;
  inviterName: string;
  role: 'admin' | 'viewer';
  acceptUrl: string;
  expiresInDays: number;
}

@Injectable()
export class InviteMailer {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = this.config.getOrThrow<string>('EMAIL_FROM');
  }

  async sendInviteEmail(input: SendInviteEmailInput): Promise<void> {
    const { subject, html, text } = await renderInviteEmail({
      organizationName: input.organizationName,
      inviterName: input.inviterName,
      role: input.role,
      acceptUrl: input.acceptUrl,
      expiresInDays: input.expiresInDays,
    });
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject,
      html,
      text,
    });
    if (error) {
      throw AppError.INVITE_EMAIL_SEND_FAILED({ reason: error.message });
    }
  }
}
```

- [ ] **Step 2: Replace `email-otp.service.ts`**

Overwrite `apps/backend/src/auth/email-otp.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { Resend } from 'resend';
import { renderOtpEmail } from '../emails/render-email';
import { AppError } from '../common/errors';
import type { Auth } from './auth.config';

@Injectable()
export class EmailOtpService {
  private readonly resend: Resend;
  private readonly emailFrom: string;

  constructor(
    private readonly authService: AuthService<Auth>,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.emailFrom = this.configService.getOrThrow<string>('EMAIL_FROM');
  }

  async sendVerificationOtp(
    email: string,
    type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email',
  ): Promise<void> {
    let otp: string;
    try {
      otp = await this.authService.api.createVerificationOTP({
        body: { email, type },
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Failed to create OTP';
      throw AppError.OTP_CREATE_FAILED({ reason });
    }

    const { subject, html, text } = await renderOtpEmail(otp, type);

    const { data, error } = await this.resend.emails.send({
      from: this.emailFrom,
      to: email,
      subject,
      html,
      text,
    });

    if (error) {
      throw AppError.OTP_EMAIL_SEND_FAILED({ reason: error.message });
    }

    console.log('OTP email sent:', data?.id);
  }
}
```

- [ ] **Step 3: Replace `email-otp.controller.ts`**

Overwrite `apps/backend/src/auth/email-otp.controller.ts`:

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { EmailOtpService } from './email-otp.service';
import { AppError } from '../common/errors';

const ALLOWED_OTP_TYPES = [
  'email-verification',
  'sign-in',
  'forget-password',
  'change-email',
] as const;

type OtpType = (typeof ALLOWED_OTP_TYPES)[number];

@Controller('api/email-otp')
export class EmailOtpController {
  constructor(private readonly emailOtpService: EmailOtpService) {}

  @AllowAnonymous()
  @Post('send-verification')
  async sendVerification(
    @Body() body: { email?: string; type?: string },
  ): Promise<{ success: boolean }> {
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
      throw AppError.EMAIL_REQUIRED();
    }

    const type = body?.type;
    if (!type || !ALLOWED_OTP_TYPES.includes(type as OtpType)) {
      throw AppError.OTP_TYPE_INVALID({ allowed: ALLOWED_OTP_TYPES });
    }

    await this.emailOtpService.sendVerificationOtp(email, type as OtpType);
    return { success: true };
  }
}
```

- [ ] **Step 4: Run all tests in apps/backend**

Run: `cd apps/backend && pnpm jest`

Expected: PASS (full suite). The OTP service does not have a dedicated spec file currently; the controller test would only run if one exists. The migration preserves status codes (`400` and `502`) so any indirect coverage continues to work.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/organizations/services/invite-mailer.ts apps/backend/src/auth/email-otp.service.ts apps/backend/src/auth/email-otp.controller.ts
git commit -m "refactor(errors): auth and mailer use AppError"
```

---

## Task 12: Final sweep

**Files:** none new — verification only.

- [ ] **Step 1: Verify no `new HttpException(...)` outside the errors module**

Run: `grep -rn "new HttpException" apps/backend/src --include="*.ts" | grep -v "common/errors"`

Expected output: empty (or only test files that reference `HttpException` for type assertions, e.g., `zod-validation.pipe.spec.ts`'s `expect(error).toBeInstanceOf(HttpException)` — that's fine because `ApiException extends HttpException`).

If any production-code hits remain, convert them to `AppError` factories or add a new entry to the registry.

- [ ] **Step 2: Verify no inlined `function apiError` helpers remain**

Run: `grep -rn "function apiError" apps/backend/src --include="*.ts"`

Expected output: empty.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd apps/backend && pnpm test`

Expected: PASS — all jest specs and the email integration script.

- [ ] **Step 4: Run lint**

Run: `cd apps/backend && pnpm lint`

Expected: PASS (warnings allowed, errors not).

- [ ] **Step 5: Build to confirm full type-check**

Run: `cd apps/backend && pnpm build`

Expected: success.

- [ ] **Step 6: Smoke test the global filter end-to-end (optional but recommended)**

This step requires a running database. If `docker compose` isn't already up, skip and note for manual QA.

If running: start the backend (`pnpm dev:backend`), then:

```bash
curl -i http://localhost:3000/api/orgs/does-not-exist \
     -H 'X-Organization-Id: nonexistent'
```

Expected: response body `{"code":"UNAUTHENTICATED","message":"Authentication required"}` with status 401 (or `{"code":"ORG_HEADER_REQUIRED",...}` if no header — depends on which guard short-circuits first).

```bash
curl -i http://localhost:3000/api/totally-unknown-route
```

Expected: response body shaped as `{"code":"NOT_FOUND","message":"...","details":...}` (the filter wraps NestJS's default 404 `HttpException`) with status 404.

- [ ] **Step 7: Final commit (if anything changed in step 1's grep cleanup)**

If steps 1–2 surfaced no leftover hits, no commit is needed. Otherwise:

```bash
git add <touched-files>
git commit -m "refactor(errors): final sweep — no leftover ad-hoc throws"
```
