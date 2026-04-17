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
import { AuthErrorPage } from "@/routes/auth-error";
import { DashboardPage } from "@/routes/dashboard";
import { GoogleSignInPage } from "@/routes/google-sign-in";
import { GoogleSignUpPage } from "@/routes/google-sign-up";
import { HomePage } from "@/routes/home";
import { SettingsPage } from "@/routes/settings";
import { SignInPage } from "@/routes/sign-in";
import { SignUpPage } from "@/routes/sign-up";
import { VerifyEmailPage } from "@/routes/verify-email";

type AuthSearch = {
  redirect?: string;
};

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

const authSearchSchema = (search: Record<string, unknown>): AuthSearch => ({
  redirect: typeof search.redirect === "string" ? search.redirect : undefined,
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
  validateSearch: authSearchSchema,
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

const authErrorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/error",
  validateSearch: authErrorSearchSchema,
  component: AuthErrorPage,
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

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  googleSignInRoute,
  googleSignUpRoute,
  verifyEmailRoute,
  authErrorRoute,
  protectedRoute.addChildren([homeRoute, dashboardRoute, settingsRoute]),
]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
