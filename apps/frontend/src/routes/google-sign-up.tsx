import { useSearch } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";

import { AuthAPI } from "@/api/auth.api";
import { AuthThemeToggle } from "@/components/theme/auth-theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildAuthErrorRoute,
  normalizeRedirectPath,
  toAbsoluteAuthErrorCallbackURL,
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

export function GoogleSignUpPage() {
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectTo = normalizeRedirectPath(search.redirect);

  useEffect(() => {
    const startGoogleSignUp = async () => {
      try {
        const callbackURL = toAbsoluteCallbackURL(redirectTo);
        const result = await AuthAPI.signInWithGoogle({
          callbackURL,
          newUserCallbackURL: callbackURL,
          errorCallbackURL: toAbsoluteAuthErrorCallbackURL(
            redirectTo,
            "sign-up",
          ),
          disableRedirect: true,
          requestSignUp: true,
        });

        if (result.error) {
          const errorMessage = getErrorMessage(
            result.error,
            "Google sign-up could not be started.",
          );
          window.location.assign(
            buildAuthErrorRoute({
              redirect: redirectTo,
              mode: "sign-up",
              message: errorMessage,
            }),
          );
          return;
        }

        if (result.data?.url) {
          window.location.assign(result.data.url);
          return;
        }

        window.location.assign(redirectTo);
      } catch (error) {
        const errorMessage = getErrorMessage(
          error,
          "Google sign-up could not be started.",
        );
        window.location.assign(
          buildAuthErrorRoute({
            redirect: redirectTo,
            mode: "sign-up",
            message: errorMessage,
          }),
        );
      }
    };

    void startGoogleSignUp();
  }, [redirectTo]);

  return (
    <>
      <AuthThemeToggle />
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Starting Google sign up</CardTitle>
          <CardDescription>
            You are being redirected to Google. This can take a moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
    </>
  );
}
