import {
  DEMO_NOW,
  demoActivity,
  demoBriefs,
  demoFeatures,
  demoPeople,
  demoRepos,
  type ActivityKind,
  type DemoActivity,
  type DemoBrief,
  type DemoFeature,
  type DemoPerson,
  type DemoProject,
  type DemoRepo,
  type DemoTeam,
  type WorkType,
} from "./demo-data";
import { useDemoState } from "@/stores/demo-state";

export function getProjectBySlug(slug: string): DemoProject | undefined {
  return useDemoState.getState().projects.find((p) => p.slug === slug);
}

export function getTeamBySlug(slug: string): DemoTeam | undefined {
  return useDemoState.getState().teams.find((t) => t.slug === slug);
}

export function getDeveloperBySlug(slug: string): DemoPerson | undefined {
  return demoPeople.find((d) => d.slug === slug);
}

export function getProjectById(id: string): DemoProject | undefined {
  return useDemoState.getState().projects.find((p) => p.id === id);
}

export function getRepoById(id: string): DemoRepo | undefined {
  return demoRepos.find((r) => r.id === id);
}

export function getDeveloperById(id: string): DemoPerson | undefined {
  return demoPeople.find((d) => d.id === id);
}

export function getTeamById(id: string): DemoTeam | undefined {
  return useDemoState.getState().teams.find((t) => t.id === id);
}

export function getFeatureById(id: string): DemoFeature | undefined {
  return demoFeatures.find((f) => f.id === id);
}

export interface ScopeFilter {
  projectId?: string;
  teamId?: string;
  devId?: string;
  repoId?: string;
  sinceDays?: number;
  kinds?: ActivityKind[];
}

export function getActivityForScope(filter: ScopeFilter = {}): DemoActivity[] {
  const cutoff = filter.sinceDays
    ? new Date(DEMO_NOW.getTime() - filter.sinceDays * 86400000).toISOString()
    : null;

  let devIdSet: Set<string> | null = null;
  if (filter.teamId) {
    const team = getTeamById(filter.teamId);
    devIdSet = new Set(team?.memberIds ?? []);
  }

  return demoActivity.filter((a) => {
    if (filter.projectId && a.projectId !== filter.projectId) return false;
    if (filter.repoId && a.repoId !== filter.repoId) return false;
    if (filter.devId && a.actorId !== filter.devId) return false;
    if (devIdSet && !devIdSet.has(a.actorId)) return false;
    if (cutoff && a.timestamp < cutoff) return false;
    if (filter.kinds && !filter.kinds.includes(a.kind)) return false;
    return true;
  });
}

export function getFeaturesForScope(filter: { projectId?: string; teamId?: string } = {}): DemoFeature[] {
  let devIds: Set<string> | null = null;
  if (filter.teamId) {
    const team = getTeamById(filter.teamId);
    devIds = new Set(team?.memberIds ?? []);
  }
  return demoFeatures.filter((f) => {
    if (filter.projectId && f.projectId !== filter.projectId) return false;
    if (devIds && !f.contributorIds.some((id) => devIds!.has(id))) return false;
    return true;
  });
}

export function getReposForProject(projectId: string): DemoRepo[] {
  const project = useDemoState.getState().projects.find((p) => p.id === projectId);
  if (!project) return [];
  return demoRepos.filter((r) => project.repoIds.includes(r.id));
}

export function getWorkDistributionForDev(devId: string, sinceDays = 7): Record<WorkType, number> {
  const events = getActivityForScope({ devId, sinceDays });
  const counts: Record<WorkType, number> = { feature: 0, optimization: 0, refactor: 0, bug: 0 };
  for (const ev of events) counts[ev.workType]++;
  const total = counts.feature + counts.optimization + counts.refactor + counts.bug;
  if (total === 0) return { feature: 25, optimization: 25, refactor: 25, bug: 25 };
  return {
    feature: Math.round((counts.feature / total) * 100),
    optimization: Math.round((counts.optimization / total) * 100),
    refactor: Math.round((counts.refactor / total) * 100),
    bug: Math.round((counts.bug / total) * 100),
  };
}

export function getWorkDistributionForScope(filter: ScopeFilter): Record<WorkType, number> {
  const events = getActivityForScope(filter);
  const counts: Record<WorkType, number> = { feature: 0, optimization: 0, refactor: 0, bug: 0 };
  for (const ev of events) counts[ev.workType]++;
  const total = counts.feature + counts.optimization + counts.refactor + counts.bug;
  if (total === 0) return { feature: 25, optimization: 25, refactor: 25, bug: 25 };
  return {
    feature: Math.round((counts.feature / total) * 100),
    optimization: Math.round((counts.optimization / total) * 100),
    refactor: Math.round((counts.refactor / total) * 100),
    bug: Math.round((counts.bug / total) * 100),
  };
}

export interface ContributionPoint {
  weekStart: string;
  commits: number;
}

export function getContributionTrend(devId: string, sinceDays = 30): ContributionPoint[] {
  const events = getActivityForScope({ devId, sinceDays, kinds: ["commit"] });
  const buckets = new Map<string, number>();
  for (const ev of events) {
    const d = new Date(ev.timestamp);
    const dow = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([weekStart, commits]) => ({ weekStart, commits }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

export interface DevKpis {
  prs: number;
  commits: number;
  linesChanged: number;
  reviews: number;
  prsDelta: number;
  commitsDelta: number;
  linesChangedDelta: number;
  reviewsDelta: number;
}

export function getKpisForDev(devId: string, sinceDays = 7): DevKpis {
  const current = getActivityForScope({ devId, sinceDays });
  const previous = demoActivity.filter((a) => {
    if (a.actorId !== devId) return false;
    const t = new Date(a.timestamp).getTime();
    const cutoff = DEMO_NOW.getTime() - sinceDays * 86400000;
    const prevCutoff = DEMO_NOW.getTime() - 2 * sinceDays * 86400000;
    return t >= prevCutoff && t < cutoff;
  });

  const count = (arr: DemoActivity[], kinds: ActivityKind[]) => arr.filter((a) => kinds.includes(a.kind)).length;
  const lines = (arr: DemoActivity[]) => arr.reduce((s, a) => s + (a.additions ?? 0) + (a.deletions ?? 0), 0);

  const prs = count(current, ["pr_opened", "pr_merged"]);
  const commits = count(current, ["commit"]);
  const linesChanged = lines(current);
  const reviews = Math.floor(prs * 1.4);
  const prsPrev = count(previous, ["pr_opened", "pr_merged"]);
  const commitsPrev = count(previous, ["commit"]);
  const linesPrev = lines(previous);
  const reviewsPrev = Math.floor(prsPrev * 1.4);

  return {
    prs,
    commits,
    linesChanged,
    reviews,
    prsDelta: prs - prsPrev,
    commitsDelta: commits - commitsPrev,
    linesChangedDelta: linesChanged - linesPrev,
    reviewsDelta: reviews - reviewsPrev,
  };
}

export function getRecentPrsForDev(devId: string, limit = 10): DemoActivity[] {
  return demoActivity
    .filter((a) => a.actorId === devId && (a.kind === "pr_opened" || a.kind === "pr_merged"))
    .slice(0, limit);
}

export function getBriefsForScope(filter: { projectId?: string; teamId?: string; devId?: string }): DemoBrief[] {
  return demoBriefs.filter((b) => {
    if (filter.projectId) return b.scope.type === "project" && b.scope.projectId === filter.projectId;
    if (filter.teamId)    return b.scope.type === "team"    && b.scope.teamId    === filter.teamId;
    if (filter.devId)     return b.scope.type === "developer" && b.scope.devId   === filter.devId;
    return true;
  });
}

export function getProjectHealth(projectId: string): number {
  const features = getFeaturesForScope({ projectId }).filter((f) => f.status !== "shipped" && f.status !== "on_hold");
  if (features.length === 0) return 100;
  const onTrack = features.filter((f) => f.status === "in_flight").length;
  return Math.round((onTrack / features.length) * 100);
}

export function formatRelative(iso: string): string {
  const diffMs = DEMO_NOW.getTime() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}
