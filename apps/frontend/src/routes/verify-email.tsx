import { Link, useSearch } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  normalizeRedirectPath,
} from "@/lib/auth-redirect";
import { useSendVerificationOtp, useVerifyEmailOtp } from "@/hooks/api/use-auth";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }

    const response = (error as { response?: { data?: { message?: unknown } } })
      .response;
    const responseMessage = response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.length > 0) {
      return responseMessage;
    }
  }

  return fallback;
}

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function VerifyEmailPage() {
  const search = useSearch({ strict: false }) as {
    redirect?: string;
    email?: string;
  };

  const redirectTo = normalizeRedirectPath(search.redirect);
  const email = typeof search.email === "string" ? search.email : "";

  const [otp, setOtp] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const verifyEmailOtp = useVerifyEmailOtp();
  const sendVerificationOtp = useSendVerificationOtp();

  const maskedEmail = useMemo(() => {
    if (!email.includes("@")) {
      return email;
    }

    const [local, domain] = email.split("@");
    if (local.length <= 2) {
      return `${"*".repeat(local.length)}@${domain}`;
    }

    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
  }, [email]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage("Missing email. Please sign up again.");
      return;
    }

    const normalizedOtp = otp.trim();
    if (normalizedOtp.length !== 6) {
      setErrorMessage("Enter the 6-digit code sent to your email.");
      return;
    }

    try {
      await verifyEmailOtp.mutateAsync({
        email,
        otp: normalizedOtp,
      });
      window.location.assign(redirectTo);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Unable to verify code. Please try again."),
      );
    }
  };

  const handleResendCode = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email) {
      setErrorMessage("Missing email. Please sign up again.");
      return;
    }

    try {
      await sendVerificationOtp.mutateAsync({
        email,
        type: "email-verification",
      });
      setSuccessMessage("A new verification code has been sent.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Unable to resend code. Please try again."),
      );
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">
              {maskedEmail || "your email"}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleVerify}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="otp">
                Verification code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                className={inputClassName}
                placeholder="123456"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                maxLength={6}
                autoComplete="one-time-code"
                required
              />
            </div>

            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="text-sm text-emerald-600" role="status">
                {successMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={verifyEmailOtp.isPending}>
              {verifyEmailOtp.isPending ? "Verifying..." : "Verify email"}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResendCode}
            disabled={sendVerificationOtp.isPending}
          >
            {sendVerificationOtp.isPending ? "Resending..." : "Resend code"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Want to use another email?{" "}
            <Link
              to="/sign-up"
              search={
                redirectTo === DEFAULT_AUTH_REDIRECT_PATH
                  ? {}
                  : { redirect: redirectTo }
              }
              className="font-medium text-primary underline"
            >
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
