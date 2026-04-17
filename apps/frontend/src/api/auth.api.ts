import {
  type AuthClientResult,
  type AuthEmailSignInRequest,
  type AuthEmailSignInResponse,
  type AuthEmailSignUpRequest,
  type AuthEmailSignUpResponse,
  type AuthGoogleSignInRequest,
  type AuthSendVerificationOtpRequest,
  type AuthSendVerificationOtpResponse,
  type AuthSessionResponse,
  type AuthSignOutResponse,
  type AuthSocialSignInResponse,
  type AuthVerifyEmailOtpRequest,
  type AuthVerifyEmailOtpResponse,
} from "@launchstack/api-interfaces";

import { axiosInstance } from "@/api/axios-client";
import { authClient } from "@/lib/auth-client";

export const AuthAPI = {
  signUpWithEmail: async (
    payload: AuthEmailSignUpRequest,
  ): Promise<AuthClientResult<AuthEmailSignUpResponse>> => {
    const response = await authClient.signUp.email(payload);
    return response as AuthClientResult<AuthEmailSignUpResponse>;
  },

  signInWithEmail: async (
    payload: AuthEmailSignInRequest,
  ): Promise<AuthClientResult<AuthEmailSignInResponse>> => {
    const response = await authClient.signIn.email(payload);
    return response as AuthClientResult<AuthEmailSignInResponse>;
  },

  signInWithGoogle: async (
    payload: AuthGoogleSignInRequest = {},
  ): Promise<AuthClientResult<AuthSocialSignInResponse>> => {
    const response = await authClient.signIn.social({
      provider: "google",
      ...payload,
    });
    return response as AuthClientResult<AuthSocialSignInResponse>;
  },

  getSession: async (): Promise<AuthClientResult<AuthSessionResponse>> => {
    const response = await authClient.getSession();
    return response as AuthClientResult<AuthSessionResponse>;
  },

  signOut: async (): Promise<AuthClientResult<AuthSignOutResponse>> => {
    const response = await authClient.signOut();
    return response as AuthClientResult<AuthSignOutResponse>;
  },

  sendVerificationOtp: async (
    payload: AuthSendVerificationOtpRequest,
  ): Promise<AuthSendVerificationOtpResponse> => {
    const response = await axiosInstance.request({
      url: "/api/email-otp/send-verification",
      method: "POST",
      data: payload,
    });

    return response.data as AuthSendVerificationOtpResponse;
  },

  verifyEmailOtp: async (
    payload: AuthVerifyEmailOtpRequest,
  ): Promise<AuthVerifyEmailOtpResponse> => {
    const response = await axiosInstance.request({
      url: "/api/auth/email-otp/verify-email",
      method: "POST",
      data: payload,
    });

    return response.data as AuthVerifyEmailOtpResponse;
  },
};
