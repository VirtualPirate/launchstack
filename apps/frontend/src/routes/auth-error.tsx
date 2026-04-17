import { AlertTriangle } from "lucide-react";
import { useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GOOGLE_SIGN_IN_ROUTE_PATH,
  GOOGLE_SIGN_UP_ROUTE_PATH,
  buildAuthRouteWithRedirect,
  normalizeRedirectPath,
} from "@/lib/auth-redirect";

type AuthMode = "sign-in" | "sign-up";

type AuthErrorSearch = {
  redirect?: string;
  message?: string;
  error?: string;
  error_description?: string;
  mode?: string;
};

function resolveMode(mode?: string): AuthMode {
  return mode === "sign-up" ? "sign-up" : "sign-in";
}

function resolveErrorMessage(search: AuthErrorSearch, mode: AuthMode) {
  if (typeof search.message === "string" && search.message.length > 0) {
    return search.message;
  }

  if (
    typeof search.error_description === "string" &&
    search.error_description.length > 0
  ) {
    return search.error_description;
  }

  if (typeof search.error === "string" && search.error.length > 0) {
    return search.error;
  }

  if (mode === "sign-up") {
    return "We could not complete Google sign-up. Please try again.";
  }

  return "We could not complete Google sign-in. Please try again.";
}

export function AuthErrorPage() {
  const search = useSearch({ strict: false }) as AuthErrorSearch;
  const mode = resolveMode(search.mode);
  const redirectTo = normalizeRedirectPath(search.redirect);
  const errorMessage = resolveErrorMessage(search, mode);

  const retryGoogleHref = buildAuthRouteWithRedirect(
    mode === "sign-up" ? GOOGLE_SIGN_UP_ROUTE_PATH : GOOGLE_SIGN_IN_ROUTE_PATH,
    redirectTo,
  );
  const authPageHref = buildAuthRouteWithRedirect(
    mode === "sign-up" ? "/sign-up" : "/sign-in",
    redirectTo,
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Authentication failed</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <a href={retryGoogleHref}>Try Google again</a>
          </Button>
          <Button asChild className="w-full" variant="outline">
            <a href={authPageHref}>
              {mode === "sign-up" ? "Back to sign up" : "Back to sign in"}
            </a>
          </Button>
          <Button asChild className="w-full" variant="ghost">
            <a href={redirectTo}>Continue to app</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
