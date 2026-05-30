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
    details: ({ details }) =>
      typeof details === 'object' && details !== null
        ? (details as Record<string, unknown>)
        : { value: details },
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
