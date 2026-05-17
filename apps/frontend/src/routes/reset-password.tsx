import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
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
  useResetPasswordWithOtp,
  useSendVerificationOtp,
} from "@/hooks/api/use-auth";

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }
  return fallback;
}

function mapResetErrorMessage(error: unknown): string {
  const raw = getErrorMessage(error, "");
  const upper = raw.toUpperCase();
  if (upper.includes("INVALID")) {
    return "Incorrect or expired code. Request a new one.";
  }
  if (upper.includes("EXPIRED")) {
    return "Code expired. Request a new one.";
  }
  return raw.length > 0 ? raw : "Couldn't reset password. Try again.";
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { email?: string };
  const email = typeof search.email === "string" ? search.email : "";

  const resetPassword = useResetPasswordWithOtp();
  const sendVerificationOtp = useSendVerificationOtp();

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const maskedEmail = useMemo(() => {
    if (!email.includes("@")) return email;
    const [local, domain] = email.split("@");
    if (local.length <= 2) return `${"*".repeat(local.length)}@${domain}`;
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
  }, [email]);

  if (!email) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset link incomplete</CardTitle>
            <CardDescription>
              We can't reset your password without an email. Start the flow
              over.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Start over</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedOtp = otp.trim();
    if (normalizedOtp.length !== 6) {
      setErrorMessage("Enter the 6-digit code sent to your email.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      const result = await resetPassword.mutateAsync({
        email,
        otp: normalizedOtp,
        password,
      });
      if (result.error) {
        setErrorMessage(mapResetErrorMessage(result.error));
        return;
      }
      navigate({ to: "/sign-in", search: { reset: "success" } });
    } catch (error) {
      setErrorMessage(mapResetErrorMessage(error));
    }
  };

  const handleResendCode = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await sendVerificationOtp.mutateAsync({
        email,
        type: "forget-password",
      });
      setSuccessMessage("A new code was sent.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Couldn't resend code. Try again."),
      );
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">
              {maskedEmail || "your email"}
            </span>{" "}
            and choose a new password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                className={inputClassName}
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={inputClassName}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
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

            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? "Resetting..." : "Reset password"}
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
            Remembered your password?{" "}
            <Link to="/sign-in" className="font-medium text-primary underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
