import type { DevKpis } from "@/lib/demo-selectors";

function delta(v: number): string {
  if (v > 0) return `+${v}`;
  return String(v);
}
function tone(v: number): string {
  if (v > 0) return "text-gb-status-shipped";
  if (v < 0) return "text-gb-status-at-risk";
  return "text-muted-foreground";
}

export function DevKpiStrip({ kpis }: { kpis: DevKpis }) {
  const items = [
    { label: "PRs",           value: kpis.prs,           delta: kpis.prsDelta },
    { label: "Commits",       value: kpis.commits,       delta: kpis.commitsDelta },
    { label: "Lines changed", value: kpis.linesChanged,  delta: kpis.linesChangedDelta },
    { label: "Reviews",       value: kpis.reviews,       delta: kpis.reviewsDelta },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{i.label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{i.value.toLocaleString()}</span>
            <span className={`text-xs ${tone(i.delta)}`}>{delta(i.delta)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
