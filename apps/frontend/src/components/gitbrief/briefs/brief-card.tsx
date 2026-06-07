import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { BriefResponse } from "@launchstack/api-interfaces";
import { ScopeLabel } from "./scope-label";
import { StatusBadge } from "./status-badge";

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function BriefCard({ brief }: { brief: BriefResponse }) {
  return (
    <Link
      to="/briefs/$briefId"
      params={{ briefId: brief.id }}
      className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors"
    >
      <div className="text-xs text-muted-foreground shrink-0 min-w-[110px]">
        <ScopeLabel scope={brief.scope} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {brief.title || "(generating…)"}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatRange(brief.periodStart, brief.periodEnd)} ·{" "}
          {brief.commitCount} commits
        </div>
      </div>
      <StatusBadge status={brief.status} />
      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}
