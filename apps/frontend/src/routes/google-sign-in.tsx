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

export function GoogleSignInPage() {
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectTo = normalizeRedirectPath(search.redirect);

  useEffect(() => {
    const startGoogleSignIn = async () => {
      try {
        const result = await AuthAPI.signInWithGoogle({
          callbackURL: toAbsoluteCallbackURL(redirectTo),
          errorCallbackURL: toAbsoluteAuthErrorCallbackURL(
            redirectTo,
            "sign-in",
          ),
          disableRedirect: true,
        });

        if (result.error) {
          const errorMessage = getErrorMessage(
            result.error,
            "Google sign-in could not be started.",
          );
          window.location.assign(
            buildAuthErrorRoute({
              redirect: redirectTo,
              mode: "sign-in",
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
          "Google sign-in could not be started.",
        );
        window.location.assign(
          buildAuthErrorRoute({
            redirect: redirectTo,
            mode: "sign-in",
            message: errorMessage,
          }),
        );
      }
    };

    void startGoogleSignIn();
  }, [redirectTo]);

  return (
    <>
      <AuthThemeToggle />
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Starting Google sign in</CardTitle>
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
