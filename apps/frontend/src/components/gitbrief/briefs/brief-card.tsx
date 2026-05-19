import { Link } from "@tanstack/react-router";
import type { DemoBrief } from "@/lib/demo-data";
import { ScopeLabel } from "./scope-label";

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function BriefCard({ brief }: { brief: DemoBrief }) {
  return (
    <Link
      to="/briefs/$briefId"
      params={{ briefId: brief.id }}
      className="block rounded-lg border bg-card p-4 hover:bg-accent/40 transition-colors"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <ScopeLabel scope={brief.scope} />
        <span>{formatPeriod(brief.periodStart, brief.periodEnd)}</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">{brief.tagline}</p>
      <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
        <span><b className="text-foreground">{brief.stats.shipped}</b> shipped</span>
        <span><b className="text-foreground">{brief.stats.inFlight}</b> in flight</span>
        {brief.stats.atRisk > 0 ? <span className="text-gb-status-at-risk"><b>{brief.stats.atRisk}</b> at risk</span> : null}
      </div>
    </Link>
  );
}
