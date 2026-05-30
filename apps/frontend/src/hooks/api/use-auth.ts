import {
  type AuthClientResult,
  type AuthEmailSignInRequest,
  type AuthEmailSignInResponse,
  type AuthEmailSignUpRequest,
  type AuthEmailSignUpResponse,
  type AuthForgetPasswordRequest,
  type AuthForgetPasswordResponse,
  type AuthGoogleSignInRequest,
  type AuthResetPasswordResponse,
  type AuthResetPasswordWithOtpRequest,
  type AuthSendVerificationOtpRequest,
  type AuthSendVerificationOtpResponse,
  type AuthSessionResponse,
  type AuthSignOutResponse,
  type AuthSocialSignInResponse,
  type AuthVerifyEmailOtpRequest,
  type AuthVerifyEmailOtpResponse,
} from "@launchstack/api-interfaces";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AuthAPI } from "../../api/auth.api";

export const authSessionQueryKey = ["auth", "session"] as const;

export function useAuthSession() {
  return useQuery<AuthClientResult<AuthSessionResponse>>({
    queryKey: authSessionQueryKey,
    queryFn: () => AuthAPI.getSession(),
    retry: false,
  });
}

export function useSignUpEmail() {
  const queryClient = useQueryClient();

  return useMutation<
    AuthClientResult<AuthEmailSignUpResponse>,
    Error,
    AuthEmailSignUpRequest
  >({
    mutationFn: (payload) => AuthAPI.signUpWithEmail(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}

export function useSignInEmail() {
  const queryClient = useQueryClient();

  return useMutation<
    AuthClientResult<AuthEmailSignInResponse>,
    Error,
    AuthEmailSignInRequest
  >({
    mutationFn: (payload) => AuthAPI.signInWithEmail(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}

export function useSignInGoogle() {
  const queryClient = useQueryClient();

  return useMutation<
    AuthClientResult<AuthSocialSignInResponse>,
    Error,
    AuthGoogleSignInRequest | undefined
  >({
    mutationFn: (payload) => AuthAPI.signInWithGoogle(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation<AuthClientResult<AuthSignOutResponse>, Error, void>({
    mutationFn: () => AuthAPI.signOut(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}

export function useSendVerificationOtp() {
  return useMutation<
    AuthSendVerificationOtpResponse,
    Error,
    AuthSendVerificationOtpRequest
  >({
    mutationFn: (payload) => AuthAPI.sendVerificationOtp(payload),
  });
}

export function useVerifyEmailOtp() {
  const queryClient = useQueryClient();

  return useMutation<
    AuthVerifyEmailOtpResponse,
    Error,
    AuthVerifyEmailOtpRequest
  >({
    mutationFn: (payload) => AuthAPI.verifyEmailOtp(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}

export function useForgetPassword() {
  return useMutation<
    AuthClientResult<AuthForgetPasswordResponse>,
    Error,
    AuthForgetPasswordRequest
  >({
    mutationFn: (payload) => AuthAPI.forgetPassword(payload),
  });
}

export function useResetPasswordWithOtp() {
  return useMutation<
    AuthClientResult<AuthResetPasswordResponse>,
    Error,
    AuthResetPasswordWithOtpRequest
  >({
    mutationFn: (payload) => AuthAPI.resetPasswordWithOtp(payload),
  });
}
