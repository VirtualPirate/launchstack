/**
 * Better Auth OpenAPI-derived request/response types.
 *
 * Source: /Users/artazasameen/Downloads/api-1 (1).json
 * Scope: /api/auth/*
 *
 * Notes:
 * - This file is documentation-first and not runtime-generated.
 * - When OpenAPI omits request or 2xx response schema, types use `unknown`.
 */

export type User = {
  id?: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id?: string;
  expiresAt: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string;
  userAgent?: string;
  userId: string;
};

export type Account = {
  id?: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  scope?: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
};

export type Verification = {
  id?: string;
  identifier: string;
  value: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthErrorResponse = {
  message: string;
};

type SignUpEmailUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChangePasswordUser = SignUpEmailUser;

type SocialSignInIdToken = {
  token: string;
  nonce?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  user?: {
    name?: { firstName?: string | null; lastName?: string | null } | null;
    email?: string | null;
  } | null;
};

type LinkSocialIdToken = {
  token: string;
  nonce?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  scopes?: unknown[] | null;
};

export type LinkedAccountListItem = {
  id: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
  accountId: string;
  userId: string;
  scopes: string[];
};

export type AccountInfoProviderUser = {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  emailVerified: boolean;
};

// POST /api/auth/sign-in/social
export type SocialSignInRequest = {
  body: {
    provider: string;
    callbackURL?: string | null;
    newUserCallbackURL?: string | null;
    errorCallbackURL?: string | null;
    disableRedirect?: boolean | null;
    idToken?: SocialSignInIdToken | null;
    scopes?: unknown[] | null;
    requestSignUp?: boolean | null;
    loginHint?: string | null;
    additionalData?: string | null;
  };
};

export type SocialSignInResponse = {
  redirect: false;
  token: string;
  user: User;
  url?: string;
};

// GET /api/auth/callback/{id}
// Path parameter is implicit in route template but not declared in spec parameters.
export type CallbackIdGetRequest = {
  params: { id: string };
};

// 2xx response not declared in spec.
export type CallbackIdGetResponse = unknown;

// POST /api/auth/callback/{id}
export type CallbackIdPostRequest = {
  params: { id: string };
  body?: Record<string, never>;
};

// 2xx response not declared in spec.
export type CallbackIdPostResponse = unknown;

// GET /api/auth/get-session
export type GetSessionGetRequest = Record<string, never>;
export type GetSessionGetResponse = { session: Session; user: User } | null;

// POST /api/auth/get-session
export type GetSessionPostRequest = { body?: Record<string, never> };
export type GetSessionPostResponse = GetSessionGetResponse;

// POST /api/auth/sign-out
export type SignOutRequest = { body?: Record<string, never> };
export type SignOutResponse = { success?: boolean };

// POST /api/auth/sign-up/email
export type SignUpWithEmailAndPasswordRequest = {
  body: {
    name: string;
    email: string;
    password: string;
    image?: string;
    callbackURL?: string;
    rememberMe?: boolean;
  };
};

export type SignUpWithEmailAndPasswordResponse = {
  token?: string | null;
  user: SignUpEmailUser;
};

// POST /api/auth/sign-in/email
export type SignInEmailRequest = {
  body: {
    email: string;
    password: string;
    callbackURL?: string | null;
    rememberMe?: boolean | null;
  };
};

export type SignInEmailResponse = {
  redirect: false;
  token: string;
  url?: string | null;
  user: User;
};

// POST /api/auth/reset-password
export type ResetPasswordRequest = {
  body: { newPassword: string; token?: string | null };
};

export type ResetPasswordResponse = { status?: boolean };

// POST /api/auth/verify-password
export type VerifyPasswordRequest = { body: { password: string } };
export type VerifyPasswordResponse = { status?: boolean };

// GET /api/auth/verify-email
export type VerifyEmailGetRequest = {
  query: { token: string; callbackURL?: string };
};

export type VerifyEmailGetResponse = { user: User; status: boolean };

// POST /api/auth/send-verification-email
export type SendVerificationEmailRequest = {
  body: { email: string; callbackURL?: string | null };
};

export type SendVerificationEmailResponse = { status?: boolean };

// POST /api/auth/change-email
export type ChangeEmailRequest = {
  body: { newEmail: string; callbackURL?: string | null };
};

export type ChangeEmailResponse = {
  status: boolean;
  user?: User;
  message?: 'Email updated' | 'Verification email sent' | null;
};

// POST /api/auth/change-password
export type ChangePasswordRequest = {
  body: {
    newPassword: string;
    currentPassword: string;
    revokeOtherSessions?: boolean | null;
  };
};

export type ChangePasswordResponse = {
  token?: string | null;
  user: ChangePasswordUser;
};

// POST /api/auth/update-session
export type UpdateSessionRequest = { body?: Record<string, never> };
export type UpdateSessionResponse = { session?: Session };

// POST /api/auth/update-user
export type UpdateUserRequest = {
  body?: { name?: string; image?: string | null };
};

export type UpdateUserResponse = { user?: User };

// POST /api/auth/delete-user
export type DeleteUserRequest = {
  body?: {
    callbackURL?: string;
    password?: string;
    token?: string;
  };
};

export type DeleteUserResponse = {
  success: boolean;
  message: 'User deleted' | 'Verification email sent';
};

// POST /api/auth/request-password-reset
export type RequestPasswordResetRequest = {
  body: { email: string; redirectTo?: string | null };
};

export type RequestPasswordResetResponse = {
  status?: boolean;
  message?: string;
};

// GET /api/auth/reset-password/{token}
export type ResetPasswordCallbackRequest = {
  params: { token: string };
  query: { callbackURL: string };
};

export type ResetPasswordCallbackResponse = { token?: string };

// GET /api/auth/list-sessions
export type ListUserSessionsRequest = Record<string, never>;
export type ListUserSessionsResponse = Session[];

// POST /api/auth/revoke-session
export type RevokeSessionRequest = { body: { token: string } };
export type RevokeSessionResponse = { status: boolean };

// POST /api/auth/revoke-sessions
export type RevokeSessionsRequest = { body?: Record<string, never> };
export type RevokeSessionsResponse = { status: boolean };

// POST /api/auth/revoke-other-sessions
export type RevokeOtherSessionsRequest = { body?: Record<string, never> };
export type RevokeOtherSessionsResponse = { status: boolean };

// POST /api/auth/link-social
export type LinkSocialAccountRequest = {
  body: {
    provider: string;
    callbackURL?: string | null;
    idToken?: LinkSocialIdToken | null;
    requestSignUp?: boolean | null;
    scopes?: unknown[] | null;
    errorCallbackURL?: string | null;
    disableRedirect?: boolean | null;
    additionalData?: string | null;
  };
};

export type LinkSocialAccountResponse = {
  redirect: boolean;
  url?: string;
  status?: boolean;
};

// GET /api/auth/list-accounts
export type ListUserAccountsRequest = Record<string, never>;
export type ListUserAccountsResponse = LinkedAccountListItem[];

// GET /api/auth/delete-user/callback
export type DeleteUserCallbackGetRequest = {
  query?: { token?: string; callbackURL?: string | null };
};

export type DeleteUserCallbackGetResponse = {
  success: boolean;
  message: 'User deleted';
};

// POST /api/auth/unlink-account
export type UnlinkAccountRequest = {
  body: { providerId: string; accountId?: string | null };
};

export type UnlinkAccountResponse = { status?: boolean };

// POST /api/auth/refresh-token
export type RefreshTokenRequest = {
  body: {
    providerId: string;
    accountId?: string | null;
    userId?: string | null;
  };
};

export type RefreshTokenResponse = {
  tokenType?: string;
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
};

// POST /api/auth/get-access-token
export type GetAccessTokenRequest = {
  body: {
    providerId: string;
    accountId?: string | null;
    userId?: string | null;
  };
};

export type GetAccessTokenResponse = {
  tokenType?: string;
  idToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
};

// GET /api/auth/account-info
export type AccountInfoRequest = Record<string, never>;
export type AccountInfoResponse = {
  user: AccountInfoProviderUser;
  data: Record<string, unknown>;
};

// GET /api/auth/ok
export type OkRequest = Record<string, never>;
export type OkResponse = { ok: boolean };

// GET /api/auth/error
export type ErrorPageRequest = Record<string, never>;
export type ErrorPageResponse = string;

// POST /api/auth/email-otp/send-verification-otp
export type SendEmailVerificationOTPRequest = {
  body: { email: string; type: string };
};

export type SendEmailVerificationOTPResponse = { success?: boolean };

// POST /api/auth/email-otp/check-verification-otp
export type VerifyEmailWithOTPRequest = {
  body: { email: string; type: string; otp: string };
};

export type VerifyEmailWithOTPResponse = { success?: boolean };

// POST /api/auth/email-otp/verify-email
export type EmailOtpVerifyEmailRequest = {
  body: { email: string; otp: string };
};

export type EmailOtpVerifyEmailResponse = {
  status: true;
  token: string | null;
  user: User;
};

// POST /api/auth/sign-in/email-otp
// Request schema is not defined in the export.
export type SignInWithEmailOTPRequest = unknown;
export type SignInWithEmailOTPResponse = { token: string; user: User };

// POST /api/auth/email-otp/request-password-reset
export type RequestPasswordResetWithEmailOTPRequest = {
  body: { email: string };
};
export type RequestPasswordResetWithEmailOTPResponse = { success?: boolean };

// POST /api/auth/forget-password/email-otp
export type ForgetPasswordWithEmailOTPRequest = { body: { email: string } };
export type ForgetPasswordWithEmailOTPResponse = { success?: boolean };

// POST /api/auth/email-otp/reset-password
export type ResetPasswordWithEmailOTPRequest = {
  body: { email: string; otp: string; password: string };
};

export type ResetPasswordWithEmailOTPResponse = { success?: boolean };

// POST /api/auth/email-otp/request-email-change
export type RequestEmailChangeWithEmailOTPRequest = {
  body: { newEmail: string; otp?: string | null };
};

export type RequestEmailChangeWithEmailOTPResponse = { success?: boolean };

// POST /api/auth/email-otp/change-email
export type ChangeEmailWithEmailOTPRequest = {
  body: { newEmail: string; otp: string };
};

export type ChangeEmailWithEmailOTPResponse = { success?: boolean };
