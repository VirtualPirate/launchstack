import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { StatStrip } from "@/components/gitbrief/shared/stat-strip";
import { ActivityFeed } from "@/components/gitbrief/feed/activity-feed";
import { FeatureProgressRow } from "@/components/gitbrief/features/feature-progress-row";
import { demoFeatures, DEMO_NOW } from "@/lib/demo-data";
import { formatRelative, getActivityForScope } from "@/lib/demo-selectors";
import { useDemoState } from "@/stores/demo-state";

export function HomePage() {
  const schedules = useDemoState((s) => s.schedules);
  const inFlightFeatures = demoFeatures
    .filter((f) => f.status === "in_flight" || f.status === "at_risk")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  const today = DEMO_NOW.toISOString().slice(0, 10);
  const shippedToday = demoFeatures.filter((f) => f.shippedAt && f.shippedAt.startsWith(today)).length;
  const prsToday = getActivityForScope({ sinceDays: 1 }).filter((a) => a.kind === "pr_merged").length;
  const queuedBriefs = schedules.filter((s) => !s.paused).length;

  const nextSched = [...schedules]
    .filter((s) => !s.paused)
    .sort((a, b) => (a.nextRunAt < b.nextRunAt ? -1 : 1))[0];

  return (
    <>
      <PageHeader
        title="Home"
        description="Everything that happened in your workspace today"
        actions={
          <Button asChild size="sm">
            <Link to="/briefs/new"><Plus className="size-3.5" /> New Brief</Link>
          </Button>
        }
      />

      <StatStrip
        className="mb-5"
        items={[
          { label: "features shipped today", value: shippedToday },
          { label: "PRs merged today", value: prsToday },
          { label: "briefs queued", value: queuedBriefs },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <ActivityFeed />

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>Feature progress</SectionLabel>
              <Link to="/projects" className="text-[11px] text-muted-foreground hover:text-foreground">View all</Link>
            </div>
            <div className="mt-3">
              {inFlightFeatures.map((f) => (
                <FeatureProgressRow key={f.id} feature={f} />
              ))}
            </div>
          </div>

          {nextSched ? (
            <div className="rounded-lg border bg-card p-4">
              <SectionLabel>Next brief</SectionLabel>
              <div className="mt-2 text-sm font-medium">{nextSched.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                in {formatRelative(nextSched.nextRunAt)}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full">Preview now</Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
