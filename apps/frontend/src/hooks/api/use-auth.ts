import {
  type AuthChangePasswordRequest,
  type AuthChangePasswordResponse,
  type AuthClientResult,
  type AuthEmailSignInRequest,
  type AuthEmailSignInResponse,
  type AuthEmailSignUpRequest,
  type AuthEmailSignUpResponse,
  type AuthForgetPasswordRequest,
  type AuthForgetPasswordResponse,
  type AuthGoogleSignInRequest,
  type AuthListAccountsResponse,
  type AuthListSessionsResponse,
  type AuthResetPasswordResponse,
  type AuthResetPasswordWithOtpRequest,
  type AuthRevokeSessionResponse,
  type AuthSendVerificationOtpRequest,
  type AuthSendVerificationOtpResponse,
  type AuthSessionResponse,
  type AuthSignOutResponse,
  type AuthSocialSignInResponse,
  type AuthUpdateUserRequest,
  type AuthUpdateUserResponse,
  type AuthVerifyEmailOtpRequest,
  type AuthVerifyEmailOtpResponse,
} from "@launchstack/api-interfaces";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { AuthAPI } from "../../api/auth.api";

export const authSessionQueryKey = ["auth", "session"] as const;

/**
 * Wipe the signed-out user from this tab: cached server state, and the
 * persisted active org the axios interceptor sends as `X-Organization-Id`.
 * Otherwise the next user in this tab inherits both.
 *
 * Call it after leaving the protected shell: mounted org-scoped screens would
 * refetch at once, and the bootstrap hook would re-install orgs[0].
 */
export function clearSignedOutUserState() {
  queryClient.clear();
  useActiveOrganizationStore.getState().clear();
}

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

export const authSessionsQueryKey = ["auth", "sessions"] as const;
export const authAccountsQueryKey = ["auth", "accounts"] as const;

/**
 * The Better Auth client resolves with `{ data, error }` instead of rejecting,
 * so a failed request would otherwise look like a successful empty one. The
 * settings screen renders a real error state for both of these, hence the
 * unwrap.
 */
function unwrap<T>(result: AuthClientResult<T>): T {
  if (result.error) {
    throw new Error(result.error.message || "Request failed");
  }
  return result.data as T;
}

/** Every device the user is signed in on, current one included. */
export function useAuthSessions() {
  return useQuery<AuthListSessionsResponse>({
    queryKey: authSessionsQueryKey,
    queryFn: async () => unwrap(await AuthAPI.listSessions()),
    retry: false,
  });
}

/** Ways the user can sign in — `credential`, `google`, … */
export function useAuthAccounts() {
  return useQuery<AuthListAccountsResponse>({
    queryKey: authAccountsQueryKey,
    queryFn: async () => unwrap(await AuthAPI.listAccounts()),
    retry: false,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation<AuthUpdateUserResponse, Error, AuthUpdateUserRequest>({
    mutationFn: async (payload) => unwrap(await AuthAPI.updateUser(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation<
    AuthChangePasswordResponse,
    Error,
    AuthChangePasswordRequest
  >({
    mutationFn: async (payload) =>
      unwrap(await AuthAPI.changePassword(payload)),
    onSuccess: async () => {
      // `revokeOtherSessions` ends every other session and reissues this one's
      // token, so both the session and the device list are stale.
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation<AuthRevokeSessionResponse, Error, { token: string }>({
    mutationFn: async (payload) =>
      unwrap(await AuthAPI.revokeSession(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey });
    },
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation<AuthRevokeSessionResponse, Error, void>({
    mutationFn: async () => unwrap(await AuthAPI.revokeOtherSessions()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authSessionsQueryKey });
    },
  });
}
