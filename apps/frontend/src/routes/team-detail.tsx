import { useParams, Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { ActivityFeed } from "@/components/gitbrief/feed/activity-feed";
import { WorkDistributionDonut } from "@/components/gitbrief/charts/work-distribution-donut";
import { BriefCard } from "@/components/gitbrief/briefs/brief-card";
import {
  getBriefsForScope,
  getDeveloperById,
  getTeamBySlug,
  getWorkDistributionForDev,
  getWorkDistributionForScope,
} from "@/lib/demo-selectors";
import { useDemoState } from "@/stores/demo-state";

export function TeamDetailPage() {
  const { teamSlug } = useParams({ strict: false }) as { teamSlug: string };
  useDemoState((s) => s.teams);
  const team = getTeamBySlug(teamSlug);
  if (!team) return <EmptyState title="Team not found" />;

  const distribution = getWorkDistributionForScope({ teamId: team.id, sinceDays: 7 });
  const briefs = getBriefsForScope({ teamId: team.id });

  return (
    <>
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><EntityDot color={team.color} /> {team.name}</span>}
        description={`${team.memberIds.length} members`}
      />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="briefs">Briefs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-3">Work distribution (7d)</div>
              <WorkDistributionDonut distribution={distribution} />
            </div>
            <div className="rounded-lg border bg-card p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-3">Members</div>
              <div className="flex flex-wrap gap-2">
                {team.memberIds.map((id) => {
                  const d = getDeveloperById(id);
                  if (!d) return null;
                  return (
                    <Link key={id} to="/people/$devSlug" params={{ devSlug: d.slug }} className="inline-flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs hover:bg-accent/40">
                      <Avatar className="size-5"><AvatarFallback className="text-[10px]" style={{ background: d.avatarColor }}>{d.name.charAt(0)}</AvatarFallback></Avatar>
                      {d.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {team.memberIds.map((id) => {
              const dev = getDeveloperById(id);
              if (!dev) return null;
              const dist = getWorkDistributionForDev(dev.id, 7);
              return (
                <div key={id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9"><AvatarFallback style={{ background: dev.avatarColor }}>{dev.name.charAt(0)}</AvatarFallback></Avatar>
                    <div>
                      <div className="text-sm font-medium">{dev.name}</div>
                      <div className="text-xs text-muted-foreground">{dev.role}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <WorkDistributionDonut distribution={dist} size={100} />
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <ActivityFeed scope={{ teamId: team.id }} />
        </TabsContent>

        <TabsContent value="briefs" className="mt-5">
          {briefs.length === 0 ? (
            <EmptyState title="No briefs yet for this team" action={<Button asChild size="sm"><Link to="/briefs/new">Create one</Link></Button>} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {briefs.map((b) => <BriefCard key={b.id} brief={b} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
