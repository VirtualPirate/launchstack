import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Zap,
} from "lucide-react";
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
import {
  BriefFilters,
  type BriefFiltersValue,
} from "@/components/gitbrief/briefs/brief-filters";
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

const EMPTY_FILTERS: BriefFiltersValue = {
  from: "",
  to: "",
  excludeNoActivity: false,
  repositoryId: "",
};

export function BriefsPage() {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterValues, setFilterValues] =
    useState<BriefFiltersValue>(EMPTY_FILTERS);
  const [pageIndex, setPageIndex] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);

  const filters = useMemo<BriefListFilters>(() => {
    const f: BriefListFilters = { limit: 20 };
    if (filterValues.repositoryId) {
      f.scopeType = "repository";
      f.scopeRepositoryId = filterValues.repositoryId;
    } else if (filterType !== "all") {
      f.scopeType = filterType;
    }
    if (filterValues.from) f.from = `${filterValues.from}T00:00:00.000Z`;
    if (filterValues.to) f.to = `${filterValues.to}T23:59:59.999Z`;
    if (filterValues.excludeNoActivity) f.excludeNoActivity = true;
    return f;
  }, [filterType, filterValues]);

  const briefsQuery = useGetBriefs(filters);
  const pages = briefsQuery.data?.pages ?? [];
  const items = pages[pageIndex]?.data.items ?? [];

  const isFirstPage = pageIndex === 0;
  const latest = isFirstPage ? items[0] : undefined;
  const listItems = isFirstPage ? items.slice(1) : items;

  const hasActiveFilters =
    filterType !== "all" ||
    !!filterValues.from ||
    !!filterValues.to ||
    filterValues.excludeNoActivity ||
    !!filterValues.repositoryId;

  const handleScopePill = (value: FilterType) => {
    setFilterType(value);
    if (value !== "repository") {
      setFilterValues((v) => ({ ...v, repositoryId: "" }));
    }
    setPageIndex(0);
  };

  const handleFiltersChange = (next: BriefFiltersValue) => {
    setFilterValues(next);
    if (next.repositoryId) setFilterType("repository");
    setPageIndex(0);
  };

  const clearAll = () => {
    setFilterType("all");
    setFilterValues(EMPTY_FILTERS);
    setPageIndex(0);
  };

  const canPrev = pageIndex > 0;
  const canNext =
    pageIndex < pages.length - 1 || (briefsQuery.hasNextPage ?? false);
  const showPager = canPrev || canNext;

  const handlePrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const handleNext = async () => {
    if (pageIndex < pages.length - 1) {
      setPageIndex((i) => i + 1);
      return;
    }
    if (briefsQuery.hasNextPage && !briefsQuery.isFetchingNextPage) {
      const res = await briefsQuery.fetchNextPage();
      if (res.data && res.data.pages.length > pageIndex + 1) {
        setPageIndex((i) => i + 1);
      }
    }
  };

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

      <section className="mb-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground pr-1">Filter by</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleScopePill(opt.value)}
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

      <BriefFilters
        value={filterValues}
        onChange={handleFiltersChange}
        className="mb-6"
      />

      {briefsQuery.isLoading ? (
        <SkeletonList rows={4} rowHeight={80} />
      ) : briefsQuery.isError ? (
        <ErrorState
          message={extractErrorMessage(briefsQuery.error)}
          onRetry={() => briefsQuery.refetch()}
        />
      ) : items.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No briefs match these filters"
            description="Try widening the date range or clearing filters."
            action={
              <Button size="sm" variant="outline" onClick={clearAll}>
                Clear filters
              </Button>
            }
          />
        ) : (
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
        )
      ) : (
        <>
          {isFirstPage && latest ? (
            <section className="mb-8">
              <SectionLabel className="mb-2">Latest brief</SectionLabel>
              <BriefViewer brief={latest} />
            </section>
          ) : null}

          {listItems.length > 0 ? (
            <section>
              {isFirstPage ? (
                <SectionLabel className="mb-3">Earlier briefs</SectionLabel>
              ) : null}
              <Card>
                <CardContent className="p-0 divide-y">
                  {listItems.map((b) => (
                    <BriefCard key={b.id} brief={b} />
                  ))}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {showPager ? (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={!canPrev}
              >
                <ChevronLeft className="size-3.5" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {pageIndex + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={!canNext || briefsQuery.isFetchingNextPage}
              >
                {briefsQuery.isFetchingNextPage ? "Loading…" : "Next"}
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </>
      )}

      <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
    </>
  );
}
