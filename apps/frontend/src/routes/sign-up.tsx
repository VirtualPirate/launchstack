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
import { useSignUpEmail } from "@/hooks/api/use-auth";
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  GOOGLE_SIGN_UP_ROUTE_PATH,
  buildVerifyEmailRoute,
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

export function SignUpPage() {
  const search = useSearch({ strict: false }) as { redirect?: string; email?: string };
  const redirectTo = normalizeRedirectPath(search.redirect);
  const callbackURL = toAbsoluteCallbackURL(redirectTo);

  const signUpEmail = useSignUpEmail();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  const handleEmailSignUp = async (values: {
    name?: string;
    email: string;
    password: string;
  }) => {
    setErrorMessage(null);

    if (!values.name) {
      setErrorMessage("Name is required.");
      return;
    }

    const result = await signUpEmail.mutateAsync({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL,
    });

    if (result.error) {
      setErrorMessage(getErrorMessage(result.error, "Unable to create account."));
      return;
    }

    window.location.assign(buildVerifyEmailRoute(values.email, redirectTo));
  };

  const handleGoogleSignUp = () => {
    setErrorMessage(null);
    setIsGoogleRedirecting(true);
    window.location.assign(
      buildAuthRouteWithRedirect(GOOGLE_SIGN_UP_ROUTE_PATH, redirectTo),
    );
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Sign up with email/password or continue with Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EmailAuthForm
            mode="sign-up"
            isPending={signUpEmail.isPending}
            errorMessage={errorMessage}
            initialEmail={search.email ?? ""}
            onSubmit={handleEmailSignUp}
          />

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <GoogleAuthButton
            isPending={isGoogleRedirecting}
            onClick={handleGoogleSignUp}
            label="Sign up with Google"
          />

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/sign-in"
              search={
                redirectTo === DEFAULT_AUTH_REDIRECT_PATH
                  ? {}
                  : { redirect: redirectTo }
              }
              className="font-medium text-primary underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
