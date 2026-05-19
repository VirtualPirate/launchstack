import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getActivityForScope, type ScopeFilter } from "@/lib/demo-selectors";
import type { ActivityKind } from "@/lib/demo-data";
import { ActivityFilterPills, type FeedFilter } from "./activity-filter-pills";
import { ActivityItem } from "./activity-item";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";

const PAGE = 20;

const kindsByFilter: Record<FeedFilter, ActivityKind[] | undefined> = {
  all: undefined,
  shipped: ["feature_shipped", "pr_merged"],
  prs: ["pr_opened", "pr_merged"],
  bugs: ["bug_fix"],
  refactors: ["refactor"],
  optimizations: [],
};

export function ActivityFeed({ scope }: { scope?: ScopeFilter }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  const items = useMemo(() => {
    const base = getActivityForScope(scope);
    if (filter === "optimizations") return base.filter((a) => a.workType === "optimization");
    const kinds = kindsByFilter[filter];
    return kinds ? base.filter((a) => kinds.includes(a.kind)) : base;
  }, [scope, filter]);

  const visible = items.slice(0, limit);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <ActivityFilterPills value={filter} onChange={(v) => { setFilter(v); setLimit(PAGE); }} />
        <span className="text-xs text-muted-foreground">{items.length} events</span>
      </div>
      {visible.length === 0 ? (
        <div className="p-6">
          <EmptyState title="No activity matches that filter" />
        </div>
      ) : (
        <ul className="divide-y">
          {visible.map((a) => <ActivityItem key={a.id} activity={a} />)}
        </ul>
      )}
      {limit < items.length ? (
        <div className="border-t px-4 py-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
