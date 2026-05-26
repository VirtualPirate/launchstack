import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { DevHeader } from "@/components/gitbrief/dev/dev-header";
import { DevKpiStrip } from "@/components/gitbrief/dev/dev-kpi-strip";
import { DevPrsList } from "@/components/gitbrief/dev/dev-prs-list";
import { WorkDistributionDonut } from "@/components/gitbrief/charts/work-distribution-donut";
import { ContributionTrend } from "@/components/gitbrief/charts/contribution-trend";
import {
  getContributionTrend,
  getDeveloperBySlug,
  getKpisForDev,
  getRecentPrsForDev,
  getWorkDistributionForDev,
} from "@/lib/demo-selectors";

export function DeveloperDetailPage() {
  const { devSlug } = useParams({ strict: false }) as { devSlug: string };
  const dev = getDeveloperBySlug(devSlug);
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(7);

  if (!dev) return <EmptyState title="Developer not found" />;

  const kpis = getKpisForDev(dev.id, periodDays);
  const distribution = getWorkDistributionForDev(dev.id, periodDays);
  const trend = getContributionTrend(dev.id, periodDays === 7 ? 30 : periodDays);
  const prs = getRecentPrsForDev(dev.id, 10);

  return (
    <>
      <PageHeader
        title=""
        description={
          <DevHeader dev={dev} periodDays={periodDays} onPeriodChange={setPeriodDays} />
        }
      />

      <div className="space-y-8">
        <DevKpiStrip kpis={kpis} />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-3">Work distribution</div>
            <WorkDistributionDonut distribution={distribution} />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-3">Contribution trend</div>
            <ContributionTrend data={trend} />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">This week, in plain English</div>
          <p className="text-sm leading-relaxed">
            {dev.name.split(" ")[0]} spent {distribution.feature >= 50 ? "most" : "a notable chunk"} of the period on{" "}
            <b>{distribution.feature >= 50 ? "new features" : distribution.optimization >= 30 ? "optimization work" : "a mix of work"}</b>.{" "}
            {kpis.prs > 0 ? <>They merged <b>{kpis.prs}</b> PRs and pushed <b>{kpis.commits}</b> commits totaling <b>{kpis.linesChanged.toLocaleString()}</b> lines changed.</> : <>No PRs this period.</>}
          </p>
        </div>

        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">Recent PRs</div>
          <DevPrsList prs={prs} />
        </div>
      </div>
    </>
  );
}
