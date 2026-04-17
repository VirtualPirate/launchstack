export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  id?: string;
  expiresAt: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId: string;
}

export interface AuthSessionResponse {
  session: AuthSession;
  user: AuthUser;
}

export interface AuthEmailSignUpResponse {
  token?: string | null;
  user: AuthUser;
}

export interface AuthEmailSignInResponse {
  redirect?: boolean;
  token?: string;
  url?: string | null;
  user: AuthUser;
}

export interface AuthSocialSignInResponse {
  redirect?: boolean;
  token?: string;
  url?: string | null;
  user?: AuthUser;
}

export interface AuthSignOutResponse {
  success?: boolean;
}

export interface AuthSendVerificationOtpResponse {
  success?: boolean;
}

export interface AuthVerifyEmailOtpResponse {
  status: true;
  token: string | null;
  user: AuthUser;
}

export interface AuthErrorResponse {
  message: string;
}

export interface AuthClientResult<TData, TError = AuthErrorResponse> {
  data: TData | null;
  error: TError | null;
}
