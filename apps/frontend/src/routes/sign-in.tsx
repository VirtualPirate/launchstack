import { Link, useSearch } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { useState } from "react";

import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSignInEmail } from "@/hooks/api/use-auth";
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  GOOGLE_SIGN_IN_ROUTE_PATH,
  buildAuthRouteWithRedirect,
  normalizeRedirectPath,
  toAbsoluteCallbackURL,
} from "@/lib/auth-redirect";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return fallback;
}

export function SignInPage() {
  const search = useSearch({ strict: false }) as {
    redirect?: string;
    reset?: "success";
  };
  const redirectTo = normalizeRedirectPath(search.redirect);
  const callbackURL = toAbsoluteCallbackURL(redirectTo);

  const signInEmail = useSignInEmail();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  const handleEmailSignIn = async (values: {
    name?: string;
    email: string;
    password: string;
  }) => {
    setErrorMessage(null);

    const result = await signInEmail.mutateAsync({
      email: values.email,
      password: values.password,
      callbackURL,
    });

    if (result.error) {
      setErrorMessage(getErrorMessage(result.error, "Unable to sign in."));
      return;
    }

    window.location.assign(redirectTo);
  };

  const handleGoogleSignIn = () => {
    setErrorMessage(null);
    setIsGoogleRedirecting(true);
    window.location.assign(
      buildAuthRouteWithRedirect(GOOGLE_SIGN_IN_ROUTE_PATH, redirectTo),
    );
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Use your email/password or continue with Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {search.reset === "success" ? (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
              role="status"
            >
              Password updated. Sign in with your new password.
            </div>
          ) : null}

          <EmailAuthForm
            mode="sign-in"
            isPending={signInEmail.isPending}
            errorMessage={errorMessage}
            onSubmit={handleEmailSignIn}
          />

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <GoogleAuthButton
            isPending={isGoogleRedirecting}
            onClick={handleGoogleSignIn}
            label="Sign in with Google"
          />

          <p className="text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link
              to="/sign-up"
              search={
                redirectTo === DEFAULT_AUTH_REDIRECT_PATH
                  ? {}
                  : { redirect: redirectTo }
              }
              className="font-medium text-primary underline"
            >
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
