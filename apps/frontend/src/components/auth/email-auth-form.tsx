import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

type EmailAuthMode = "sign-in" | "sign-up";

type EmailAuthSubmitValues = {
  name?: string;
  email: string;
  password: string;
};

interface EmailAuthFormProps {
  mode: EmailAuthMode;
  isPending?: boolean;
  errorMessage?: string | null;
  initialEmail?: string;
  onSubmit: (values: EmailAuthSubmitValues) => Promise<void> | void;
}

const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EmailAuthForm({
  mode,
  isPending = false,
  errorMessage,
  initialEmail = "",
  onSubmit,
}: EmailAuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");

  const submitLabel = useMemo(() => {
    return mode === "sign-up" ? "Create account" : "Sign in";
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      name: mode === "sign-up" ? name : undefined,
      email,
      password,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {mode === "sign-up" ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            type="text"
            className={inputClassName}
            placeholder="Jane Doe"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputClassName}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          {mode === "sign-in" ? (
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary underline"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={
            mode === "sign-up" ? "new-password" : "current-password"
          }
          required
        />
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Please wait..." : submitLabel}
      </Button>
    </form>
  );
}
