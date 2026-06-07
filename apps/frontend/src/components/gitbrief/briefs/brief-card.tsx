import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { BriefResponse } from "@launchstack/api-interfaces";
import { cn } from "@/lib/utils";
import { ScopeLabel } from "./scope-label";
import { StatusBadge } from "./status-badge";
import { NoActivityBadge } from "./no-activity-badge";
import { isNoActivityBrief, stripNoActivitySuffix } from "./brief-utils";

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startStr = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  if (start.toDateString() === end.toDateString()) return startStr;
  const endStr = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export function BriefCard({ brief }: { brief: BriefResponse }) {
  const noActivity = isNoActivityBrief(brief);

  return (
    <Link
      to="/briefs/$briefId"
      params={{ briefId: brief.id }}
      className={cn(
        "flex items-center gap-4 px-4 py-3 transition hover:bg-accent/40",
        noActivity && "opacity-60 hover:opacity-100",
      )}
    >
      <div className="text-xs text-muted-foreground shrink-0 min-w-[110px]">
        <ScopeLabel scope={brief.scope} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {noActivity
            ? stripNoActivitySuffix(brief.title)
            : brief.title || "(generating…)"}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {noActivity
            ? formatRange(brief.periodStart, brief.periodEnd)
            : `${formatRange(brief.periodStart, brief.periodEnd)} · ${brief.commitCount} commits`}
        </div>
      </div>
      {noActivity ? <NoActivityBadge /> : <StatusBadge status={brief.status} />}
      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}
