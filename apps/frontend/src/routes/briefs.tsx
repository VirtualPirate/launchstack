import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { BriefViewer } from "@/components/gitbrief/briefs/brief-viewer";
import { ScopeLabel } from "@/components/gitbrief/briefs/scope-label";
import { demoPeople, type DemoBrief } from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";
import { cn } from "@/lib/utils";

type FilterType = "all" | "project" | "team" | "developer";

const TYPE_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "team", label: "Teams" },
  { value: "developer", label: "Developers" },
];

function briefMatchesType(brief: DemoBrief, type: FilterType): boolean {
  if (type === "all") return true;
  return brief.scope.type === type;
}

function briefMatchesEntity(brief: DemoBrief, type: FilterType, entityId: string | null): boolean {
  if (!entityId) return true;
  if (type === "project")   return brief.scope.type === "project"   && brief.scope.projectId === entityId;
  if (type === "team")      return brief.scope.type === "team"      && brief.scope.teamId === entityId;
  if (type === "developer") return brief.scope.type === "developer" && brief.scope.devId === entityId;
  return true;
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function BriefsPage() {
  const briefs = useDemoState((s) => s.briefs);
  const projects = useDemoState((s) => s.projects);
  const teams = useDemoState((s) => s.teams);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [entityId, setEntityId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return briefs
      .filter((b) => briefMatchesType(b, filterType) && briefMatchesEntity(b, filterType, entityId))
      .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
  }, [briefs, filterType, entityId]);

  const latest = filtered[0];
  const older = filtered.slice(1);

  const entityChips = (() => {
    if (filterType === "project")   return projects.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    if (filterType === "team")      return teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
    if (filterType === "developer") return demoPeople.map((d) => ({ id: d.id, name: d.name, color: d.avatarColor }));
    return [];
  })();

  return (
    <>
      <PageHeader
        title="Briefs"
        description="Plain-English summaries of what your team shipped, in flight, and at risk."
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/briefs/scheduled">
                <CalendarClock className="size-3.5" /> Manage schedules
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/briefs/new">
                <Plus className="size-3.5" /> New brief
              </Link>
            </Button>
          </>
        }
      />

      <section className="mb-6 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground pr-1">Filter by</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setFilterType(opt.value);
                setEntityId(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filterType === opt.value
                  ? "bg-foreground text-background border-transparent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {entityChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            <button
              type="button"
              onClick={() => setEntityId(null)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                entityId === null
                  ? "bg-accent text-accent-foreground border-transparent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Any
            </button>
            {entityChips.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEntityId(e.id === entityId ? null : e.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  entityId === e.id
                    ? "bg-accent text-accent-foreground border-transparent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <EntityDot color={e.color} /> {e.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {!latest ? (
        <EmptyState
          title="No briefs match this filter"
          description="Try a different scope, or create a new brief."
          action={
            <Button asChild size="sm">
              <Link to="/briefs/new">New brief</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section className="mb-8">
            <SectionLabel className="mb-2">Latest brief</SectionLabel>
            <BriefViewer brief={latest} />
          </section>

          {older.length > 0 ? (
            <section>
              <SectionLabel className="mb-3">
                Earlier briefs <span className="ml-1 text-muted-foreground/60">({older.length})</span>
              </SectionLabel>
              <div className="rounded-lg border bg-card divide-y">
                {older.map((b) => (
                  <Link
                    key={b.id}
                    to="/briefs/$briefId"
                    params={{ briefId: b.id }}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="text-xs text-muted-foreground shrink-0 min-w-[110px]">
                      <ScopeLabel scope={b.scope} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{b.tagline}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{b.cadenceLabel}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatPeriod(b.periodStart, b.periodEnd)}
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
