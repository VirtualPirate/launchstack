import { AlertTriangle, Loader2 } from "lucide-react";
import type { BriefResponse } from "@launchstack/api-interfaces";
import { Card, CardContent } from "@/components/ui/card";
import { ScopeLabel } from "./scope-label";
import { StatusBadge } from "./status-badge";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatPeriod(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startStr = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export function BriefViewer({
  brief,
  onRetry,
}: {
  brief: BriefResponse;
  onRetry?: () => void;
}) {
  const isWorking = brief.status === "pending" || brief.status === "generating";
  const isFailed = brief.status === "failed";
  const hasPartialFailure = brief.status === "delivered" && !!brief.failureReason;

  return (
    <article className="rounded-xl border bg-card p-7">
      <header className="flex items-start justify-between gap-4 border-b pb-5 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px]">
            <ScopeLabel scope={brief.scope} />
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight">
            {brief.title || (isWorking ? "Generating brief…" : "(untitled)")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPeriod(brief.periodStart, brief.periodEnd)} · {brief.contributorCount}{" "}
            contributors · {brief.commitCount} commits
          </p>
        </div>
        <StatusBadge status={brief.status} />
      </header>

      {isWorking ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Generating brief…
        </div>
      ) : isFailed ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-5 text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <span className="font-medium">Brief generation failed</span>
            </div>
            {brief.failureReason ? (
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {brief.failureReason}
              </pre>
            ) : null}
            {onRetry ? (
              <div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {brief.summary || "(no summary)"}
          </p>
          {hasPartialFailure ? (
            <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
              Some delivery channels failed: {brief.failureReason}
            </div>
          ) : null}
        </>
      )}

      <footer className="mt-8 flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <span>Generated: {formatTimestamp(brief.generatedAt)}</span>
        <span>Delivered: {formatTimestamp(brief.deliveredAt)}</span>
      </footer>
    </article>
  );
}
