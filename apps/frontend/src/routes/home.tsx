import { Link } from "@tanstack/react-router";
import { CalendarClock, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { SkeletonList } from "@/components/gitbrief/shared/skeleton-list";
import { BriefCard } from "@/components/gitbrief/briefs/brief-card";
import { ScopeLabel } from "@/components/gitbrief/briefs/scope-label";
import { GenerateDialog } from "@/components/gitbrief/briefs/generate-dialog";
import { useAuthSession } from "@/hooks/api/use-auth";
import { useGetBriefSchedules } from "@/hooks/api/use-brief-schedules";
import { useGetBriefsFirstPage } from "@/hooks/api/use-briefs";
import { cadenceLabel, formatTimestamp } from "@/lib/cadence-label";

export function HomePage() {
  const sessionQuery = useAuthSession();
  const schedulesQuery = useGetBriefSchedules();
  const briefsQuery = useGetBriefsFirstPage({ limit: 5 });

  const [generateOpen, setGenerateOpen] = useState(false);

  const userName = sessionQuery.data?.data?.user.name ?? "there";

  const nextSchedule = [...(schedulesQuery.data?.data ?? [])]
    .filter((s) => !s.paused)
    .sort((a, b) => (a.nextRunAt < b.nextRunAt ? -1 : 1))[0];

  const briefs = briefsQuery.data?.data.items ?? [];

  return (
    <>
      <PageHeader
        title={`Hi, ${userName}`}
        description="Recent briefs and what's next on your schedule."
        actions={
          <>
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

      {nextSchedule ? (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <CalendarClock className="size-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{nextSchedule.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <ScopeLabel scope={nextSchedule.scope} />
                  <span className="ml-2">· {cadenceLabel(nextSchedule)}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Next run
              </div>
              <div className="text-sm font-medium">
                {formatTimestamp(nextSchedule.nextRunAt)}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section>
        <SectionLabel className="mb-3">Recent briefs</SectionLabel>
        {briefsQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : briefs.length === 0 ? (
          <EmptyState
            title="No briefs yet"
            description="Generate one now, or create a schedule for recurring delivery."
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
          <Card>
            <CardContent className="p-0 divide-y">
              {briefs.map((b) => (
                <BriefCard key={b.id} brief={b} />
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <GenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
    </>
  );
}
