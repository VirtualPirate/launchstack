import { useLocation } from "@tanstack/react-router";
import { Bell, ChevronDown, ChevronRight, FileText, GitBranch, Home, Plug, Settings as SettingsIcon } from "lucide-react";
import { demoPeople, demoTeams } from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";
import { useSidebarPrefs, type SidebarScope } from "@/stores/sidebar-prefs-store";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { PinToggle } from "./pin-toggle";
import { SidebarItem } from "./sidebar-item";
import { SidebarSection } from "./sidebar-section";

interface PinnableRecord {
  id: string;
  slug: string;
  name: string;
  color: string;
}

function toRecord(r: { id: string; slug: string; name: string; color?: string; avatarColor?: string }): PinnableRecord {
  return { id: r.id, slug: r.slug, name: r.name, color: r.color ?? r.avatarColor ?? "" };
}

function detectActiveSlug(pathname: string, scope: SidebarScope): string | null {
  const prefix = `/${scope}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  if (!rest) return null;
  return rest.split("/")[0] || null;
}

function findBySlug(records: PinnableRecord[], slug: string | null): PinnableRecord | null {
  if (!slug) return null;
  return records.find((r) => r.slug === slug) ?? null;
}

function PinnableSection({
  scope,
  label,
  records,
  detailPathFor,
  indexPath,
}: {
  scope: SidebarScope;
  label: string;
  records: PinnableRecord[];
  detailPathFor: (slug: string) => string;
  indexPath: string;
}) {
  const location = useLocation();
  const pinnedIds = useSidebarPrefs((s) => s.pinned[scope]);
  const collapsed = useSidebarPrefs((s) => s.collapsed[scope]);
  const toggleCollapse = useSidebarPrefs((s) => s.toggleCollapse);

  const byId = new Map(records.map((r) => [r.id, r]));
  const pinnedRecords = pinnedIds.map((id) => byId.get(id)).filter((r): r is PinnableRecord => Boolean(r));

  const activeSlug = detectActiveSlug(location.pathname, scope);
  const activeRecord = findBySlug(records, activeSlug);
  const activeIsPinned = activeRecord ? pinnedIds.includes(activeRecord.id) : false;
  const showActive = activeRecord && !activeIsPinned;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => toggleCollapse(scope)}
        className="flex w-full items-center gap-1 px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70 hover:text-muted-foreground"
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        <span>{label}</span>
        {collapsed ? <span className="ml-1 normal-case tracking-normal">({records.length})</span> : null}
      </button>
      {collapsed ? null : (
        <div className="flex flex-col gap-0.5">
          {pinnedRecords.map((r) => (
            <SidebarItem
              key={r.id}
              to={detailPathFor(r.slug)}
              icon={<EntityDot color={r.color} />}
              trailing={<PinToggle scope={scope} id={r.id} />}
            >
              {r.name}
            </SidebarItem>
          ))}
          {showActive && activeRecord ? (
            <SidebarItem
              key={`active-${activeRecord.id}`}
              to={detailPathFor(activeRecord.slug)}
              icon={<EntityDot color={activeRecord.color} />}
              trailing={<PinToggle scope={scope} id={activeRecord.id} />}
            >
              {activeRecord.name}
            </SidebarItem>
          ) : null}
          <SidebarItem to={indexPath}>
            <span className="text-muted-foreground">Show all {records.length} →</span>
          </SidebarItem>
        </div>
      )}
    </div>
  );
}

export function SidebarNav() {
  const schedules = useDemoState((s) => s.schedules);
  const briefs = useDemoState((s) => s.briefs);
  const projects = useDemoState((s) => s.projects);
  const briefCount = briefs.length;
  const inboxCount = schedules.filter((s) => !s.paused).length;

  const projectRecords = projects.map(toRecord);
  const teamRecords = demoTeams.map(toRecord);
  const peopleRecords = demoPeople.map(toRecord);

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3 text-sm">
      <SidebarSection>
        <SidebarItem to="/" icon={<Home className="size-3.5" />} exact>Home</SidebarItem>
        <SidebarItem to="/briefs" icon={<FileText className="size-3.5" />} count={briefCount}>Briefs</SidebarItem>
        <SidebarItem to="/invites" icon={<Bell className="size-3.5" />} count={inboxCount}>Inbox</SidebarItem>
      </SidebarSection>

      <PinnableSection
        scope="projects"
        label="Projects"
        records={projectRecords}
        detailPathFor={(slug) => `/projects/${slug}`}
        indexPath="/projects"
      />
      <PinnableSection
        scope="teams"
        label="Teams"
        records={teamRecords}
        detailPathFor={(slug) => `/teams/${slug}`}
        indexPath="/teams"
      />
      <PinnableSection
        scope="people"
        label="People"
        records={peopleRecords}
        detailPathFor={(slug) => `/people/${slug}`}
        indexPath="/people"
      />

      <SidebarSection label="Sources">
        <SidebarItem to="/repositories" icon={<GitBranch className="size-3.5" />}>Repositories</SidebarItem>
        <SidebarItem to="/integrations/github" icon={<Plug className="size-3.5" />}>Integrations</SidebarItem>
      </SidebarSection>

      <SidebarSection label="Workspace">
        <SidebarItem to="/settings" icon={<SettingsIcon className="size-3.5" />}>Settings</SidebarItem>
      </SidebarSection>
    </nav>
  );
}
