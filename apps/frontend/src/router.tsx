import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import App from "@/App";
import { AuthAPI } from "@/api/auth.api";
import { normalizeRedirectPath } from "@/lib/auth-redirect";
import { AcceptInvitePage } from "@/routes/accept-invite";
import { AuthErrorPage } from "@/routes/auth-error";
import { CreateOrganizationPage } from "@/routes/create-organization";
import { DashboardPage } from "@/routes/dashboard";
import { ForgotPasswordPage } from "@/routes/forgot-password";
import { GoogleSignInPage } from "@/routes/google-sign-in";
import { GoogleSignUpPage } from "@/routes/google-sign-up";
import { HomePage } from "@/routes/home";
import { IntegrationsGithubPage } from "@/routes/integrations-github";
import { OrganizationMembersPage } from "@/routes/organization-members";
import { OrganizationSettingsPage } from "@/routes/organization-settings";
import { PendingInvitesPage } from "@/routes/pending-invites";
import { ResetPasswordPage } from "@/routes/reset-password";
import { SettingsPage } from "@/routes/settings";
import { SignInPage } from "@/routes/sign-in";
import { SignUpPage } from "@/routes/sign-up";
import { VerifyEmailPage } from "@/routes/verify-email";

type AuthSearch = {
  redirect?: string;
  email?: string;
};

type SignInSearch = AuthSearch & { reset?: "success" };

type VerifyEmailSearch = {
  redirect?: string;
  email?: string;
};

type AuthErrorSearch = {
  redirect?: string;
  mode?: "sign-in" | "sign-up";
  message?: string;
  error?: string;
  error_description?: string;
};

type ResetPasswordSearch = { email?: string };

type AcceptInviteSearch = {
  token?: string;
};

type IntegrationsGithubSearch = {
  connected?: string;
  error?: string;
};

const authSearchSchema = (search: Record<string, unknown>): AuthSearch => ({
  redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  email: typeof search.email === "string" ? search.email : undefined,
});

const signInSearchSchema = (
  search: Record<string, unknown>,
): SignInSearch => ({
  redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  email: typeof search.email === "string" ? search.email : undefined,
  reset: search.reset === "success" ? "success" : undefined,
});

const resetPasswordSearchSchema = (
  search: Record<string, unknown>,
): ResetPasswordSearch => ({
  email: typeof search.email === "string" ? search.email : undefined,
});

const verifyEmailSearchSchema = (
  search: Record<string, unknown>,
): VerifyEmailSearch => ({
  redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  email: typeof search.email === "string" ? search.email : undefined,
});

const authErrorSearchSchema = (
  search: Record<string, unknown>,
): AuthErrorSearch => ({
  redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  mode:
    search.mode === "sign-in" || search.mode === "sign-up"
      ? search.mode
      : undefined,
  message: typeof search.message === "string" ? search.message : undefined,
  error: typeof search.error === "string" ? search.error : undefined,
  error_description:
    typeof search.error_description === "string"
      ? search.error_description
      : undefined,
});

const acceptInviteSearchSchema = (
  search: Record<string, unknown>,
): AcceptInviteSearch => ({
  token: typeof search.token === "string" ? search.token : undefined,
});

const integrationsGithubSearchSchema = (
  search: Record<string, unknown>,
): IntegrationsGithubSearch => ({
  connected:
    typeof search.connected === "string" ? search.connected : undefined,
  error: typeof search.error === "string" ? search.error : undefined,
});

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Page not found.
    </div>
  ),
});

async function redirectAuthenticatedUser(search: AuthSearch) {
  const sessionResult = await AuthAPI.getSession();
  if (!sessionResult.data?.session) {
    return;
  }

  if (sessionResult.data.user.emailVerified !== true) {
    throw redirect({
      to: "/verify-email",
      search: {
        email: sessionResult.data.user.email,
        redirect: normalizeRedirectPath(search.redirect),
      },
    });
  }

  throw redirect({ to: normalizeRedirectPath(search.redirect) });
}

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: signInSearchSchema,
  beforeLoad: async ({ search }) => {
    await redirectAuthenticatedUser(search);
  },
  component: SignInPage,
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  validateSearch: authSearchSchema,
  beforeLoad: async ({ search }) => {
    await redirectAuthenticatedUser(search);
  },
  component: SignUpPage,
});

const googleSignInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/google-sign-in",
  validateSearch: authSearchSchema,
  beforeLoad: async ({ search }) => {
    await redirectAuthenticatedUser(search);
  },
  component: GoogleSignInPage,
});

const googleSignUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/google-sign-up",
  validateSearch: authSearchSchema,
  beforeLoad: async ({ search }) => {
    await redirectAuthenticatedUser(search);
  },
  component: GoogleSignUpPage,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  validateSearch: verifyEmailSearchSchema,
  beforeLoad: async ({ search }) => {
    const sessionResult = await AuthAPI.getSession();
    if (sessionResult.data?.session && sessionResult.data.user.emailVerified === true) {
      throw redirect({ to: normalizeRedirectPath(search.redirect) });
    }
  },
  component: VerifyEmailPage,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  validateSearch: authSearchSchema,
  beforeLoad: async ({ search }) => {
    await redirectAuthenticatedUser(search);
  },
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordPage,
});

const authErrorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/error",
  validateSearch: authErrorSearchSchema,
  component: AuthErrorPage,
});

const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invite",
  validateSearch: acceptInviteSearchSchema,
  component: AcceptInvitePage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async ({ location }) => {
    const sessionResult = await AuthAPI.getSession();
    if (!sessionResult.data?.session) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: location.pathname,
        },
      });
    }

    if (sessionResult.data.user.emailVerified !== true) {
      throw redirect({
        to: "/verify-email",
        search: {
          email: sessionResult.data.user.email,
          redirect: location.pathname,
        },
      });
    }
  },
  component: App,
});

const homeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  component: HomePage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings",
  component: SettingsPage,
});

const createOrganizationRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/organizations/new",
  component: CreateOrganizationPage,
});

const pendingInvitesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/invites",
  component: PendingInvitesPage,
});

const organizationSettingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings/organization",
  component: OrganizationSettingsPage,
});

const organizationMembersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings/organization/members",
  component: OrganizationMembersPage,
});

const integrationsGithubRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/integrations/github",
  validateSearch: integrationsGithubSearchSchema,
  component: IntegrationsGithubPage,
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  googleSignInRoute,
  googleSignUpRoute,
  verifyEmailRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  authErrorRoute,
  acceptInviteRoute,
  protectedRoute.addChildren([
    homeRoute,
    dashboardRoute,
    settingsRoute,
    createOrganizationRoute,
    pendingInvitesRoute,
    organizationSettingsRoute,
    organizationMembersRoute,
    integrationsGithubRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
