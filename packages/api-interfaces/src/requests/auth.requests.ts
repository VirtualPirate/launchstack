export interface AuthEmailSignUpRequest {
  name: string;
  email: string;
  password: string;
  image?: string;
  callbackURL?: string;
  rememberMe?: boolean;
}

export interface AuthEmailSignInRequest {
  email: string;
  password: string;
  callbackURL?: string;
  rememberMe?: boolean;
}

export interface AuthGoogleSignInRequest {
  callbackURL?: string;
  newUserCallbackURL?: string;
  errorCallbackURL?: string;
  disableRedirect?: boolean;
  requestSignUp?: boolean;
  loginHint?: string;
  additionalData?: Record<string, unknown>;
}

export type AuthOtpVerificationType = "email-verification";

export interface AuthSendVerificationOtpRequest {
  email: string;
  type: AuthOtpVerificationType;
}

export interface AuthVerifyEmailOtpRequest {
  email: string;
  otp: string;
}
