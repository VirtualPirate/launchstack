import { useRef, useState, type FormEvent } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_HOLD_MS = 2200;
const SUCCESS_HOLD_MS = 4200;

interface Props {
  buttonLabel?: string;
}

type Status = "idle" | "invalid" | "success";

export default function WaitlistForm({ buttonLabel = "Join waitlist" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setStatus("invalid");
      inputRef.current?.focus();
      window.setTimeout(() => setStatus("idle"), INVALID_HOLD_MS);
      return;
    }
    setConfirmedEmail(trimmed);
    setStatus("success");
    setEmail("");
    window.setTimeout(() => {
      setStatus("idle");
      setConfirmedEmail(null);
    }, SUCCESS_HOLD_MS);
  }

  const placeholder =
    status === "invalid"
      ? "Enter a valid work email"
      : status === "success" && confirmedEmail
      ? `Confirmation sent to ${confirmedEmail}`
      : "you@company.com";

  const buttonText = status === "success" ? "You're in ✓" : buttonLabel;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
      className={[
        "flex gap-2 max-w-[460px] p-1.5 border rounded-[10px] transition-colors max-sm:flex-col max-sm:p-2",
        status === "success"
          ? "border-accent bg-[color-mix(in_oklch,var(--color-accent)_6%,var(--color-surface))]"
          : "border-border-strong bg-surface focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-accent)_18%,transparent)]",
      ].join(" ")}
    >
      <label htmlFor="waitlist-email" className="sr-only">Work email</label>
      <input
        id="waitlist-email"
        ref={inputRef}
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        aria-invalid={status === "invalid"}
        disabled={status === "success"}
        required
        className={[
          "flex-1 min-w-0 px-3 h-10 bg-transparent border-0 outline-none text-fg placeholder:text-muted-2",
          "max-sm:h-11 max-sm:px-2",
          status === "invalid" ? "placeholder:text-[oklch(78%_0.18_25)]" : "",
        ].join(" ")}
      />
      <button
        type="submit"
        disabled={status === "success"}
        className={[
          "h-10 px-4 rounded-md text-sm font-medium border-0 transition-colors whitespace-nowrap",
          "bg-fg text-bg hover:bg-accent disabled:opacity-100",
          "max-sm:h-11 max-sm:w-full",
        ].join(" ")}
      >
        {buttonText}
      </button>
      <p className="sr-only" aria-live="polite">
        {status === "invalid" ? "Email is invalid" : status === "success" ? "You are on the waitlist" : ""}
      </p>
    </form>
  );
}
