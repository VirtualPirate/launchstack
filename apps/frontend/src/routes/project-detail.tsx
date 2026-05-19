import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { ActivityFeed } from "@/components/gitbrief/feed/activity-feed";
import { FeatureProgressRow } from "@/components/gitbrief/features/feature-progress-row";
import { FeatureKanban } from "@/components/gitbrief/features/feature-kanban";
import { WorkDistributionDonut } from "@/components/gitbrief/charts/work-distribution-donut";
import { BriefCard } from "@/components/gitbrief/briefs/brief-card";
import { ScheduledBriefRow } from "@/components/gitbrief/briefs/scheduled-brief-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getBriefsForScope,
  getDeveloperById,
  getFeaturesForScope,
  getProjectBySlug,
  getReposForProject,
  getWorkDistributionForDev,
  formatRelative,
} from "@/lib/demo-selectors";
import { useDemoState } from "@/stores/demo-state";

export function ProjectDetailPage() {
  const { projectSlug } = useParams({ strict: false }) as { projectSlug: string };
  const project = getProjectBySlug(projectSlug);
  const navigate = useNavigate();
  const allSchedules = useDemoState((s) => s.schedules);

  if (!project) {
    return <EmptyState title="Project not found" />;
  }

  const features = getFeaturesForScope({ projectId: project.id });
  const repos = getReposForProject(project.id);
  const briefs = getBriefsForScope({ projectId: project.id });
  const scheduled = allSchedules.filter(
    (s) => s.scope.type === "project" && s.scope.projectId === project.id,
  );

  return (
    <>
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><EntityDot color={project.color} /> {project.name}</span>}
        description={project.description}
        actions={<Button size="sm" onClick={() => navigate({ to: "/briefs/new" })}>+ Generate brief</Button>}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="contributors">Contributors</TabsTrigger>
          <TabsTrigger value="repos">Repos</TabsTrigger>
          <TabsTrigger value="briefs">Briefs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-5 md:grid-cols-[1fr_320px]">
            <ActivityFeed scope={{ projectId: project.id }} />
            <div className="rounded-lg border bg-card p-4">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Feature progress</div>
              <div className="mt-3">
                {features.filter((f) => f.status !== "shipped").map((f) => <FeatureProgressRow key={f.id} feature={f} />)}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-5">
          <FeatureKanban features={features} />
        </TabsContent>

        <TabsContent value="contributors" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {project.memberIds.map((id) => {
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

        <TabsContent value="repos" className="mt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead className="w-[140px]">Last commit</TableHead>
                <TableHead className="w-[100px]">Open PRs</TableHead>
                <TableHead className="w-[140px]">Language</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repos.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell className="text-sm">{formatRelative(r.lastCommitAt)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.openPrCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.primaryLanguage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="briefs" className="mt-5 space-y-6">
          {scheduled.length > 0 ? (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">Scheduled</div>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Cadence</TableHead><TableHead>Next run</TableHead><TableHead>Delivery</TableHead><TableHead>Last sent</TableHead><TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduled.map((s) => <ScheduledBriefRow key={s.id} schedule={s} />)}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">Recent</div>
            {briefs.length === 0 ? (
              <EmptyState title="No briefs yet for this project" action={<Button asChild size="sm"><Link to="/briefs/new">Create one</Link></Button>} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {briefs.map((b) => <BriefCard key={b.id} brief={b} />)}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
