import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Plus, Zap } from "lucide-react";
import type { BriefScopeType } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import {
  ErrorState,
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { SkeletonList } from "@/components/gitbrief/shared/skeleton-list";
import { BriefViewer } from "@/components/gitbrief/briefs/brief-viewer";
import { BriefCard } from "@/components/gitbrief/briefs/brief-card";
import { GenerateDialog } from "@/components/gitbrief/briefs/generate-dialog";
import { useGetBriefs, type BriefListFilters } from "@/hooks/api/use-briefs";
import { cn } from "@/lib/utils";

type FilterType = "all" | BriefScopeType;

const TYPE_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "team", label: "Teams" },
  { value: "collaborator", label: "Collaborators" },
  { value: "repository", label: "Repositories" },
];

export function BriefsPage() {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [generateOpen, setGenerateOpen] = useState(false);

  const filters = useMemo<BriefListFilters>(() => {
    if (filterType === "all") return { limit: 20 };
    return { scopeType: filterType, limit: 20 };
  }, [filterType]);

  const briefsQuery = useGetBriefs(filters);
  const allItems = useMemo(() => {
    return briefsQuery.data?.pages.flatMap((p) => p.data.items) ?? [];
  }, [briefsQuery.data]);

  const latest = allItems[0];
  const older = allItems.slice(1);

  return (
    <>
      <PageHeader
        title="Briefs"
        description="Plain-English summaries of what your team shipped, in flight, and at risk."
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link to="/schedules">
                <CalendarClock className="size-3.5" /> Manage schedules
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
              <Zap className="size-3.5" /> Generate now
            </Button>
            <Button asChild size="sm">
              <Link to="/schedules/new">
                <Plus className="size-3.5" /> New schedule
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
              onClick={() => setFilterType(opt.value)}
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
      </section>

      {briefsQuery.isLoading ? (
        <SkeletonList rows={4} rowHeight={80} />
      ) : briefsQuery.isError ? (
        <ErrorState
          message={extractErrorMessage(briefsQuery.error)}
          onRetry={() => briefsQuery.refetch()}
        />
      ) : !latest ? (
        <EmptyState
          title="No briefs yet"
          description="Generate one now or create a schedule for recurring delivery."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
                <Zap className="size-3.5" /> Generate now
              </Button>
              <Button asChild size="sm">
                <Link to="/schedules/new">
                  <Plus className="size-3.5" /> New schedule
                </Link>
              </Button>
            </div>
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
                Earlier briefs{" "}
                <span className="ml-1 text-muted-foreground/60">({older.length})</span>
              </SectionLabel>
              <Card>
                <CardContent className="p-0 divide-y">
                  {older.map((b) => (
                    <BriefCard key={b.id} brief={b} />
                  ))}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {briefsQuery.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => briefsQuery.fetchNextPage()}
                disabled={briefsQuery.isFetchingNextPage}
              >
                {briefsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
    </>
  );
}
