// Fixed reference date so the prototype's "now" is deterministic across reloads.
// All relative timestamps in selectors compute from this anchor.
export const DEMO_NOW = new Date("2026-05-19T16:00:00Z");

export type FeatureStatus = "in_flight" | "at_risk" | "shipped" | "on_hold";
export type WorkType = "feature" | "optimization" | "refactor" | "bug";
export type ActivityKind =
  | "commit"
  | "pr_opened"
  | "pr_merged"
  | "feature_shipped"
  | "bug_fix"
  | "refactor";

export interface DemoOrg {
  id: string;
  name: string;
  slug: string;
}

export interface DemoProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  repoIds: string[];
  memberIds: string[];
}

export interface DemoTeam {
  id: string;
  slug: string;
  name: string;
  color: string;
  memberIds: string[];
}

export interface DemoPerson {
  id: string;
  slug: string;
  name: string;
  githubHandle: string;
  teamIds: string[];
  avatarColor: string;
  role: string;
}

export interface DemoRepo {
  id: string;
  name: string;
  projectId: string;
  primaryLanguage: string;
  openPrCount: number;
  lastCommitAt: string;
}

export interface DemoFeature {
  id: string;
  title: string;
  description: string;
  projectId: string;
  contributorIds: string[];
  status: FeatureStatus;
  progress: number;
  aiEtaDays: number | null;
  shippedAt: string | null;
  workTypeBreakdown: Record<WorkType, number>;
}

export interface DemoActivity {
  id: string;
  timestamp: string;
  kind: ActivityKind;
  actorId: string;
  target: string;
  projectId: string;
  repoId: string;
  workType: WorkType;
  prNumber?: number;
  additions?: number;
  deletions?: number;
}

export type BriefScope =
  | { type: "project"; projectId: string }
  | { type: "team"; teamId: string }
  | { type: "developer"; devId: string }
  | { type: "repo"; repoId: string };

export type Cadence =
  | { type: "daily"; time: string }
  | { type: "weekly"; day: number; time: string }
  | { type: "monthly"; dayOfMonth: number; time: string };

export type DeliveryChannel =
  | { type: "dashboard" }
  | { type: "email"; recipients: string[] }
  | { type: "slack"; channel: string };

export interface DemoSchedule {
  id: string;
  name: string;
  scope: BriefScope;
  cadence: Cadence;
  delivery: DeliveryChannel[];
  paused: boolean;
  nextRunAt: string;
  lastSentAt: string | null;
  options: {
    includeFeatureProgress: boolean;
    includeWorkDistribution: boolean;
  };
}

export interface BriefNarrativeSection {
  heading: string;
  paragraphs: string[];
}

export interface DemoBrief {
  id: string;
  scheduleId: string | null;
  scope: BriefScope;
  periodStart: string;
  periodEnd: string;
  cadenceLabel: string;
  tagline: string;
  title: string;
  contributorCount: number;
  commitCount: number;
  stats: {
    shipped: number;
    inFlight: number;
    atRisk: number;
    prsMerged: number;
    deltaShipped: number;
    deltaPrs: number;
  };
  workDistribution: Record<WorkType, number>;
  featureRollup: Array<{
    featureId: string;
    status: FeatureStatus;
    progress: number;
    aiEtaDays: number | null;
  }>;
  perDevDistribution: Array<{
    devId: string;
    distribution: Record<WorkType, number>;
    dominant: WorkType;
  }>;
  sections: BriefNarrativeSection[];
  generatedAt: string;
}

export const demoOrg: DemoOrg = {
  id: "org_finlens",
  name: "Finlens",
  slug: "finlens",
};

export const demoProjects: DemoProject[] = [
  {
    id: "proj_cosmos",
    slug: "cosmos",
    name: "Cosmos",
    description: "E-commerce platform — checkout, payments, auth.",
    color: "oklch(0.62 0.18 277)",
    repoIds: ["repo_backend_core", "repo_web_app", "repo_payment_service", "repo_auth_service", "repo_admin_dash"],
    memberIds: ["dev_alex", "dev_sarah", "dev_jordan", "dev_maya"],
  },
  {
    id: "proj_atlas",
    slug: "atlas",
    name: "Atlas",
    description: "Infrastructure & internal tooling.",
    color: "oklch(0.75 0.16 70)",
    repoIds: ["repo_atlas_infra", "repo_atlas_cli", "repo_webhook_service", "repo_metrics_collector"],
    memberIds: ["dev_maya", "dev_priya", "dev_leo"],
  },
  {
    id: "proj_pulse",
    slug: "pulse",
    name: "Pulse",
    description: "Analytics & customer-facing dashboards.",
    color: "oklch(0.72 0.18 145)",
    repoIds: ["repo_pulse_api", "repo_pulse_ui", "repo_pulse_etl", "repo_pulse_alerts", "repo_pulse_docs"],
    memberIds: ["dev_sam", "dev_riley"],
  },
];

export const demoTeams: DemoTeam[] = [
  {
    id: "team_frontend",
    slug: "frontend",
    name: "Frontend",
    color: "oklch(0.62 0.22 305)",
    memberIds: ["dev_sarah", "dev_riley", "dev_maya"],
  },
  {
    id: "team_platform",
    slug: "platform",
    name: "Platform",
    color: "oklch(0.66 0.16 200)",
    memberIds: ["dev_alex", "dev_jordan", "dev_priya", "dev_leo", "dev_sam"],
  },
];

export const demoPeople: DemoPerson[] = [
  { id: "dev_alex",   slug: "alex-wong",   name: "Alex Wong",   githubHandle: "alexwong",   teamIds: ["team_platform"], avatarColor: "oklch(0.62 0.18 277)", role: "Staff engineer" },
  { id: "dev_sarah",  slug: "sarah-chen",  name: "Sarah Chen",  githubHandle: "sarahc",     teamIds: ["team_frontend"], avatarColor: "oklch(0.75 0.16 70)",  role: "Senior frontend" },
  { id: "dev_jordan", slug: "jordan-park", name: "Jordan Park", githubHandle: "jordanp",    teamIds: ["team_platform"], avatarColor: "oklch(0.72 0.18 145)", role: "Backend engineer" },
  { id: "dev_maya",   slug: "maya-rao",    name: "Maya Rao",    githubHandle: "mayar",      teamIds: ["team_frontend", "team_platform"], avatarColor: "oklch(0.62 0.22 305)", role: "Full stack" },
  { id: "dev_priya",  slug: "priya-shah",  name: "Priya Shah",  githubHandle: "priyas",     teamIds: ["team_platform"], avatarColor: "oklch(0.68 0.22 25)",  role: "Platform engineer" },
  { id: "dev_leo",    slug: "leo-martin",  name: "Leo Martin",  githubHandle: "leom",       teamIds: ["team_platform"], avatarColor: "oklch(0.66 0.16 200)", role: "Infra engineer" },
  { id: "dev_sam",    slug: "sam-iqbal",   name: "Sam Iqbal",   githubHandle: "samiqbal",   teamIds: ["team_platform"], avatarColor: "oklch(0.7 0.15 50)",   role: "Data engineer" },
  { id: "dev_riley",  slug: "riley-novak", name: "Riley Novak", githubHandle: "rileynov",   teamIds: ["team_frontend"], avatarColor: "oklch(0.7 0.15 330)",  role: "Designer-engineer" },
];

export const demoRepos: DemoRepo[] = [
  { id: "repo_backend_core",     name: "backend-core",       projectId: "proj_cosmos", primaryLanguage: "TypeScript", openPrCount: 4, lastCommitAt: "2026-05-19T14:20:00Z" },
  { id: "repo_web_app",          name: "web-app",            projectId: "proj_cosmos", primaryLanguage: "TypeScript", openPrCount: 3, lastCommitAt: "2026-05-19T15:30:00Z" },
  { id: "repo_payment_service",  name: "payment-service",    projectId: "proj_cosmos", primaryLanguage: "Go",         openPrCount: 1, lastCommitAt: "2026-05-19T11:05:00Z" },
  { id: "repo_auth_service",     name: "auth-service",       projectId: "proj_cosmos", primaryLanguage: "TypeScript", openPrCount: 2, lastCommitAt: "2026-05-19T13:10:00Z" },
  { id: "repo_admin_dash",       name: "admin-dash",         projectId: "proj_cosmos", primaryLanguage: "TypeScript", openPrCount: 0, lastCommitAt: "2026-05-18T17:40:00Z" },
  { id: "repo_atlas_infra",      name: "atlas-infra",        projectId: "proj_atlas",  primaryLanguage: "HCL",        openPrCount: 2, lastCommitAt: "2026-05-19T09:00:00Z" },
  { id: "repo_atlas_cli",        name: "atlas-cli",          projectId: "proj_atlas",  primaryLanguage: "Go",         openPrCount: 1, lastCommitAt: "2026-05-17T12:30:00Z" },
  { id: "repo_webhook_service",  name: "webhook-service",    projectId: "proj_atlas",  primaryLanguage: "Go",         openPrCount: 3, lastCommitAt: "2026-05-19T10:55:00Z" },
  { id: "repo_metrics_collector",name: "metrics-collector",  projectId: "proj_atlas",  primaryLanguage: "Rust",       openPrCount: 0, lastCommitAt: "2026-05-15T16:00:00Z" },
  { id: "repo_pulse_api",        name: "pulse-api",          projectId: "proj_pulse",  primaryLanguage: "Python",     openPrCount: 1, lastCommitAt: "2026-05-19T08:00:00Z" },
  { id: "repo_pulse_ui",         name: "pulse-ui",           projectId: "proj_pulse",  primaryLanguage: "TypeScript", openPrCount: 2, lastCommitAt: "2026-05-19T12:00:00Z" },
  { id: "repo_pulse_etl",        name: "pulse-etl",          projectId: "proj_pulse",  primaryLanguage: "Python",     openPrCount: 0, lastCommitAt: "2026-05-18T07:30:00Z" },
  { id: "repo_pulse_alerts",     name: "pulse-alerts",       projectId: "proj_pulse",  primaryLanguage: "TypeScript", openPrCount: 1, lastCommitAt: "2026-05-19T07:10:00Z" },
  { id: "repo_pulse_docs",       name: "pulse-docs",         projectId: "proj_pulse",  primaryLanguage: "MDX",        openPrCount: 0, lastCommitAt: "2026-05-13T15:00:00Z" },
];

export const demoFeatures: DemoFeature[] = [
  {
    id: "feat_stripe_gateway",
    title: "Stripe Payment Gateway",
    description: "Integrate Stripe checkout, saved cards, and webhook reconciliation.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_alex", "dev_sarah"],
    status: "shipped",
    progress: 100,
    aiEtaDays: null,
    shippedAt: "2026-05-19T14:00:00Z",
    workTypeBreakdown: { feature: 50, optimization: 30, refactor: 15, bug: 5 },
  },
  {
    id: "feat_auth_redesign",
    title: "Auth Redesign",
    description: "Modern auth modal with social providers and passkeys.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_sarah", "dev_jordan"],
    status: "in_flight",
    progress: 85,
    aiEtaDays: 3,
    shippedAt: null,
    workTypeBreakdown: { feature: 70, optimization: 5, refactor: 20, bug: 5 },
  },
  {
    id: "feat_form_validation",
    title: "Form Validation",
    description: "International phone numbers and edge-case email handling.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_sarah"],
    status: "shipped",
    progress: 100,
    aiEtaDays: null,
    shippedAt: "2026-05-18T11:00:00Z",
    workTypeBreakdown: { feature: 60, optimization: 5, refactor: 5, bug: 30 },
  },
  {
    id: "feat_search_v2",
    title: "Search Indexing v2",
    description: "Postgres FTS replacement with Tantivy-backed index.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_jordan", "dev_alex"],
    status: "in_flight",
    progress: 62,
    aiEtaDays: 8,
    shippedAt: null,
    workTypeBreakdown: { feature: 45, optimization: 40, refactor: 10, bug: 5 },
  },
  {
    id: "feat_webhook_v3",
    title: "Webhook Retry v3",
    description: "Exactly-once delivery with dead-letter queue.",
    projectId: "proj_atlas",
    contributorIds: ["dev_maya", "dev_priya"],
    status: "at_risk",
    progress: 42,
    aiEtaDays: 12,
    shippedAt: null,
    workTypeBreakdown: { feature: 30, optimization: 20, refactor: 35, bug: 15 },
  },
  {
    id: "feat_metrics_dash",
    title: "Metrics Dashboard",
    description: "Real-time SLO dashboards for platform team.",
    projectId: "proj_atlas",
    contributorIds: ["dev_leo"],
    status: "in_flight",
    progress: 35,
    aiEtaDays: 15,
    shippedAt: null,
    workTypeBreakdown: { feature: 80, optimization: 5, refactor: 10, bug: 5 },
  },
  {
    id: "feat_pulse_alerts",
    title: "Customer Alerts v1",
    description: "User-defined threshold alerts via email and Slack.",
    projectId: "proj_pulse",
    contributorIds: ["dev_sam", "dev_riley"],
    status: "in_flight",
    progress: 70,
    aiEtaDays: 5,
    shippedAt: null,
    workTypeBreakdown: { feature: 75, optimization: 10, refactor: 10, bug: 5 },
  },
  {
    id: "feat_db_indexing",
    title: "DB Indexing Pass",
    description: "Catalog-wide index audit and rebuild.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_alex"],
    status: "shipped",
    progress: 100,
    aiEtaDays: null,
    shippedAt: "2026-05-14T17:00:00Z",
    workTypeBreakdown: { feature: 5, optimization: 90, refactor: 5, bug: 0 },
  },
  {
    id: "feat_oauth_refresh",
    title: "OAuth Refresh Token Rotation",
    description: "RFC-compliant rotation with revocation.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_jordan"],
    status: "shipped",
    progress: 100,
    aiEtaDays: null,
    shippedAt: "2026-05-12T15:30:00Z",
    workTypeBreakdown: { feature: 60, optimization: 10, refactor: 25, bug: 5 },
  },
  {
    id: "feat_etl_partitioning",
    title: "ETL Partitioning",
    description: "Time-partitioned tables for analytics warehouse.",
    projectId: "proj_pulse",
    contributorIds: ["dev_sam"],
    status: "shipped",
    progress: 100,
    aiEtaDays: null,
    shippedAt: "2026-05-10T10:00:00Z",
    workTypeBreakdown: { feature: 30, optimization: 60, refactor: 10, bug: 0 },
  },
  {
    id: "feat_admin_audit_log",
    title: "Admin Audit Log",
    description: "Append-only audit log surfaced in admin UI.",
    projectId: "proj_cosmos",
    contributorIds: ["dev_maya"],
    status: "on_hold",
    progress: 20,
    aiEtaDays: null,
    shippedAt: null,
    workTypeBreakdown: { feature: 80, optimization: 5, refactor: 10, bug: 5 },
  },
];

// Deterministic seeded RNG so demoActivity is identical across reloads.
function mulberry32(seed: number) {
  let t = seed;
  return function rand() {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function generateDemoActivity(): DemoActivity[] {
  const rand = mulberry32(20260519);
  const kinds: ActivityKind[] = ["commit", "pr_opened", "pr_merged", "feature_shipped", "bug_fix", "refactor"];
  const titles = {
    feature: [
      "Add checkout drawer",
      "Implement saved-card UX",
      "Wire OAuth provider toggles",
      "Render new auth modal",
      "Build alert rule editor",
      "Add metric chart hover",
      "Connect SSO config",
      "Add CSV export",
    ],
    optimization: [
      "Index orders.created_at",
      "Cache product list",
      "Batch webhook deliveries",
      "Reduce auth bundle size",
      "Memoize feature flag lookup",
    ],
    refactor: [
      "Extract payment service",
      "Split auth router",
      "Normalize event schema",
      "Move shared types to package",
      "Replace inline SQL with query builder",
    ],
    bug: [
      "Fix int'l phone validation",
      "Fix retry race condition",
      "Fix double-charge edge case",
      "Fix dark-mode contrast on chips",
      "Fix webhook idempotency",
    ],
  };

  const entries: DemoActivity[] = [];
  const reposByProject: Record<string, string[]> = {};
  for (const repo of demoRepos) {
    (reposByProject[repo.projectId] ??= []).push(repo.id);
  }
  const peopleByProject: Record<string, string[]> = {};
  for (const project of demoProjects) {
    peopleByProject[project.id] = [...project.memberIds];
  }

  for (let day = 0; day < 28; day++) {
    const dayDate = new Date(DEMO_NOW);
    dayDate.setUTCDate(dayDate.getUTCDate() - day);
    const dow = dayDate.getUTCDay();
    const weekdayBoost = dow === 0 || dow === 6 ? 2 : 12;
    const eventsToday = Math.floor(weekdayBoost + rand() * 4);

    for (let i = 0; i < eventsToday; i++) {
      const project = pick(demoProjects, rand);
      const kindRoll = rand();
      let kind: ActivityKind;
      if (kindRoll < 0.45) kind = "commit";
      else if (kindRoll < 0.65) kind = "pr_opened";
      else if (kindRoll < 0.85) kind = "pr_merged";
      else if (kindRoll < 0.9) kind = "feature_shipped";
      else if (kindRoll < 0.96) kind = "bug_fix";
      else kind = "refactor";

      const workType: WorkType =
        kind === "bug_fix" ? "bug" : kind === "refactor" ? "refactor" : rand() < 0.25 ? "optimization" : "feature";

      const repoId = pick(reposByProject[project.id]!, rand);
      const actorId = pick(peopleByProject[project.id]!, rand);
      const title = pick(titles[workType], rand);

      const hour = 9 + Math.floor(rand() * 9);
      const minute = Math.floor(rand() * 60);
      const ts = new Date(dayDate);
      ts.setUTCHours(hour, minute, 0, 0);

      entries.push({
        id: `act_${day}_${i}`,
        timestamp: ts.toISOString(),
        kind,
        actorId,
        target: title,
        projectId: project.id,
        repoId,
        workType,
        prNumber: kind.startsWith("pr_") ? 1000 + entries.length : undefined,
        additions: kind === "commit" || kind.startsWith("pr_") ? Math.floor(rand() * 400) : undefined,
        deletions: kind === "commit" || kind.startsWith("pr_") ? Math.floor(rand() * 200) : undefined,
      });
    }
  }
  void kinds;
  entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return entries;
}

export const demoActivity: DemoActivity[] = generateDemoActivity();

export const demoSchedules: DemoSchedule[] = [
  {
    id: "sched_cosmos_weekly",
    name: "Cosmos Weekly Brief",
    scope: { type: "project", projectId: "proj_cosmos" },
    cadence: { type: "weekly", day: 5, time: "16:00" },
    delivery: [
      { type: "dashboard" },
      { type: "slack", channel: "#product-updates" },
      { type: "email", recipients: ["leads@finlens.app"] },
    ],
    paused: false,
    nextRunAt: "2026-05-22T16:00:00Z",
    lastSentAt: "2026-05-15T16:00:00Z",
    options: { includeFeatureProgress: true, includeWorkDistribution: true },
  },
  {
    id: "sched_platform_daily",
    name: "Platform Daily Standup",
    scope: { type: "team", teamId: "team_platform" },
    cadence: { type: "daily", time: "09:00" },
    delivery: [
      { type: "dashboard" },
      { type: "slack", channel: "#platform-standup" },
    ],
    paused: false,
    nextRunAt: "2026-05-20T09:00:00Z",
    lastSentAt: "2026-05-19T09:00:00Z",
    options: { includeFeatureProgress: true, includeWorkDistribution: false },
  },
  {
    id: "sched_alex_weekly",
    name: "Alex's Weekly",
    scope: { type: "developer", devId: "dev_alex" },
    cadence: { type: "weekly", day: 1, time: "10:00" },
    delivery: [{ type: "email", recipients: ["alex@finlens.app"] }],
    paused: false,
    nextRunAt: "2026-05-25T10:00:00Z",
    lastSentAt: "2026-05-18T10:00:00Z",
    options: { includeFeatureProgress: false, includeWorkDistribution: true },
  },
  {
    id: "sched_pulse_monthly",
    name: "Pulse Monthly Roll-up",
    scope: { type: "project", projectId: "proj_pulse" },
    cadence: { type: "monthly", dayOfMonth: 1, time: "09:00" },
    delivery: [{ type: "dashboard" }, { type: "email", recipients: ["board@finlens.app"] }],
    paused: true,
    nextRunAt: "2026-06-01T09:00:00Z",
    lastSentAt: "2026-05-01T09:00:00Z",
    options: { includeFeatureProgress: true, includeWorkDistribution: true },
  },
];

export const demoBriefs: DemoBrief[] = [
  {
    id: "brief_cosmos_w20",
    scheduleId: "sched_cosmos_weekly",
    scope: { type: "project", projectId: "proj_cosmos" },
    periodStart: "2026-05-12T00:00:00Z",
    periodEnd: "2026-05-19T00:00:00Z",
    cadenceLabel: "Weekly · Project Cosmos",
    tagline: "A steady week — Stripe shipped, Auth landing Friday.",
    title: "Project Cosmos · Weekly Brief",
    contributorCount: 3,
    commitCount: 24,
    stats: { shipped: 3, inFlight: 2, atRisk: 0, prsMerged: 24, deltaShipped: 1, deltaPrs: 4 },
    workDistribution: { feature: 55, optimization: 25, refactor: 15, bug: 5 },
    featureRollup: [
      { featureId: "feat_stripe_gateway", status: "shipped", progress: 100, aiEtaDays: null },
      { featureId: "feat_auth_redesign",  status: "in_flight", progress: 85, aiEtaDays: 3 },
      { featureId: "feat_search_v2",      status: "in_flight", progress: 62, aiEtaDays: 8 },
      { featureId: "feat_form_validation",status: "shipped", progress: 100, aiEtaDays: null },
    ],
    perDevDistribution: [
      { devId: "dev_alex",   distribution: { feature: 20, optimization: 60, refactor: 15, bug: 5 },  dominant: "optimization" },
      { devId: "dev_sarah",  distribution: { feature: 78, optimization: 7,  refactor: 5,  bug: 10 }, dominant: "feature" },
      { devId: "dev_jordan", distribution: { feature: 30, optimization: 25, refactor: 10, bug: 35 }, dominant: "bug" },
    ],
    sections: [
      {
        heading: "What shipped",
        paragraphs: [
          "The team deployed the new **Stripe Payment Gateway** on Thursday, closing out a two-week effort. **Alex** handled the backend integration (heavy refactoring of the payment service) while **Sarah** wrapped the UI components — including the new checkout drawer and saved-card UX.",
          "**Form Validation** also went out, fixing the long-standing edge case where international phone numbers were rejected.",
        ],
      },
      {
        heading: "Feature progress",
        paragraphs: [
          "**Auth Redesign** is **85% complete**. The AI predicts shipment in 3 days, slightly delayed by a security refactor Jordan flagged on Tuesday — worth the trade.",
          "**Search Indexing v2** at **62%**. No blockers reported.",
        ],
      },
      {
        heading: "Team breakdown",
        paragraphs: [
          "Alex spent 60% of the week on optimization (mostly db indexing). Sarah was almost entirely on new features. Jordan led the security refactor and also closed 4 bugs.",
        ],
      },
    ],
    generatedAt: "2026-05-19T16:02:00Z",
  },
  {
    id: "brief_cosmos_w19",
    scheduleId: "sched_cosmos_weekly",
    scope: { type: "project", projectId: "proj_cosmos" },
    periodStart: "2026-05-05T00:00:00Z",
    periodEnd: "2026-05-12T00:00:00Z",
    cadenceLabel: "Weekly · Project Cosmos",
    tagline: "Quiet week — OAuth landed, Stripe in final review.",
    title: "Project Cosmos · Weekly Brief",
    contributorCount: 3,
    commitCount: 18,
    stats: { shipped: 2, inFlight: 3, atRisk: 0, prsMerged: 18, deltaShipped: 0, deltaPrs: -3 },
    workDistribution: { feature: 60, optimization: 15, refactor: 20, bug: 5 },
    featureRollup: [
      { featureId: "feat_oauth_refresh", status: "shipped", progress: 100, aiEtaDays: null },
      { featureId: "feat_stripe_gateway", status: "in_flight", progress: 90, aiEtaDays: 4 },
    ],
    perDevDistribution: [
      { devId: "dev_alex",  distribution: { feature: 40, optimization: 40, refactor: 15, bug: 5 }, dominant: "feature" },
      { devId: "dev_sarah", distribution: { feature: 80, optimization: 5,  refactor: 10, bug: 5 }, dominant: "feature" },
    ],
    sections: [
      { heading: "What shipped", paragraphs: ["**OAuth Refresh Token Rotation** went live Tuesday — clean rollout, no incidents."] },
      { heading: "Feature progress", paragraphs: ["**Stripe Payment Gateway** at 90%. Final review with payments compliance on Friday."] },
    ],
    generatedAt: "2026-05-12T16:02:00Z",
  },
  {
    id: "brief_atlas_w20",
    scheduleId: null,
    scope: { type: "project", projectId: "proj_atlas" },
    periodStart: "2026-05-12T00:00:00Z",
    periodEnd: "2026-05-19T00:00:00Z",
    cadenceLabel: "Weekly · Project Atlas",
    tagline: "Webhook v3 slipping — postgres lock the blocker.",
    title: "Project Atlas · Weekly Brief",
    contributorCount: 3,
    commitCount: 12,
    stats: { shipped: 0, inFlight: 2, atRisk: 1, prsMerged: 12, deltaShipped: -1, deltaPrs: 2 },
    workDistribution: { feature: 30, optimization: 20, refactor: 40, bug: 10 },
    featureRollup: [
      { featureId: "feat_webhook_v3",   status: "at_risk",   progress: 42, aiEtaDays: 12 },
      { featureId: "feat_metrics_dash", status: "in_flight", progress: 35, aiEtaDays: 15 },
    ],
    perDevDistribution: [
      { devId: "dev_maya",  distribution: { feature: 25, optimization: 15, refactor: 50, bug: 10 }, dominant: "refactor" },
      { devId: "dev_priya", distribution: { feature: 30, optimization: 30, refactor: 30, bug: 10 }, dominant: "feature" },
      { devId: "dev_leo",   distribution: { feature: 70, optimization: 10, refactor: 15, bug: 5 },  dominant: "feature" },
    ],
    sections: [
      { heading: "Feature progress", paragraphs: ["**Webhook Retry v3** slipped 5 days. Postgres advisory-lock contention under high concurrency — Maya is investigating a queue-based approach instead. Worth a check-in."] },
    ],
    generatedAt: "2026-05-19T16:02:00Z",
  },
  {
    id: "brief_pulse_w20",
    scheduleId: null,
    scope: { type: "project", projectId: "proj_pulse" },
    periodStart: "2026-05-12T00:00:00Z",
    periodEnd: "2026-05-19T00:00:00Z",
    cadenceLabel: "Weekly · Project Pulse",
    tagline: "Alerts v1 closing in on shippable.",
    title: "Project Pulse · Weekly Brief",
    contributorCount: 2,
    commitCount: 15,
    stats: { shipped: 0, inFlight: 1, atRisk: 0, prsMerged: 15, deltaShipped: 0, deltaPrs: 5 },
    workDistribution: { feature: 75, optimization: 10, refactor: 10, bug: 5 },
    featureRollup: [
      { featureId: "feat_pulse_alerts", status: "in_flight", progress: 70, aiEtaDays: 5 },
    ],
    perDevDistribution: [
      { devId: "dev_sam",   distribution: { feature: 70, optimization: 20, refactor: 5,  bug: 5 }, dominant: "feature" },
      { devId: "dev_riley", distribution: { feature: 80, optimization: 5,  refactor: 10, bug: 5 }, dominant: "feature" },
    ],
    sections: [
      { heading: "Feature progress", paragraphs: ["**Customer Alerts v1** at 70%. Sam wrapped the rule engine; Riley is on the editor UI. AI predicts shipment in 5 days."] },
    ],
    generatedAt: "2026-05-19T16:02:00Z",
  },
  {
    id: "brief_platform_d519",
    scheduleId: "sched_platform_daily",
    scope: { type: "team", teamId: "team_platform" },
    periodStart: "2026-05-18T00:00:00Z",
    periodEnd: "2026-05-19T00:00:00Z",
    cadenceLabel: "Daily · Platform team",
    tagline: "Quiet morning — 6 PRs in review.",
    title: "Platform · Daily Standup",
    contributorCount: 5,
    commitCount: 8,
    stats: { shipped: 0, inFlight: 3, atRisk: 1, prsMerged: 4, deltaShipped: 0, deltaPrs: 1 },
    workDistribution: { feature: 40, optimization: 25, refactor: 25, bug: 10 },
    featureRollup: [],
    perDevDistribution: [],
    sections: [
      { heading: "Yesterday", paragraphs: ["Alex closed two PRs against backend-core. Jordan finished the auth security review."] },
      { heading: "Today", paragraphs: ["6 PRs in review. No blockers reported."] },
    ],
    generatedAt: "2026-05-19T09:02:00Z",
  },
  {
    id: "brief_alex_w20",
    scheduleId: "sched_alex_weekly",
    scope: { type: "developer", devId: "dev_alex" },
    periodStart: "2026-05-12T00:00:00Z",
    periodEnd: "2026-05-19T00:00:00Z",
    cadenceLabel: "Weekly · Alex Wong",
    tagline: "Optimization-heavy week — Stripe & db indexing.",
    title: "Alex Wong · Weekly Brief",
    contributorCount: 1,
    commitCount: 11,
    stats: { shipped: 2, inFlight: 1, atRisk: 0, prsMerged: 9, deltaShipped: 1, deltaPrs: 2 },
    workDistribution: { feature: 20, optimization: 60, refactor: 15, bug: 5 },
    featureRollup: [
      { featureId: "feat_stripe_gateway", status: "shipped", progress: 100, aiEtaDays: null },
      { featureId: "feat_db_indexing",    status: "shipped", progress: 100, aiEtaDays: null },
      { featureId: "feat_search_v2",      status: "in_flight", progress: 62, aiEtaDays: 8 },
    ],
    perDevDistribution: [],
    sections: [
      { heading: "This week", paragraphs: ["Alex spent most of the week on the **payment service refactor** that unblocked Stripe's launch, then closed out the catalog-wide **db indexing pass**. Search Indexing v2 picks back up Monday."] },
    ],
    generatedAt: "2026-05-19T10:02:00Z",
  },
];
