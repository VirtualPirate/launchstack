import { useLocation } from "@tanstack/react-router";
import { Bell, FileText, Home, Plug, Settings as SettingsIcon, GitBranch } from "lucide-react";
import { demoPeople, demoProjects, demoTeams } from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { SidebarItem } from "./sidebar-item";
import { SidebarSection } from "./sidebar-section";

export function SidebarNav() {
  const location = useLocation();
  const schedules = useDemoState((s) => s.schedules);
  const briefs = useDemoState((s) => s.briefs);
  const briefCount = briefs.length;
  const inboxCount = schedules.filter((s) => !s.paused).length;

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3 text-sm">
      <SidebarSection>
        <SidebarItem to="/" icon={<Home className="size-3.5" />} exact>Home</SidebarItem>
        <SidebarItem to="/briefs" icon={<FileText className="size-3.5" />} count={briefCount}>Briefs</SidebarItem>
        <SidebarItem to="/invites" icon={<Bell className="size-3.5" />} count={inboxCount}>Inbox</SidebarItem>
      </SidebarSection>

      <SidebarSection label="Projects">
        {demoProjects.map((p) => {
          const isActive = location.pathname.startsWith(`/projects/${p.slug}`);
          return (
            <div key={p.id}>
              <SidebarItem to={`/projects/${p.slug}`} icon={<EntityDot color={p.color} />}>
                {p.name}
              </SidebarItem>
              {isActive
                ? p.repoIds.map((repoId) => (
                    <SidebarItem key={repoId} to={`/projects/${p.slug}#repo-${repoId}`} indent>
                      ↳ {repoId.replace("repo_", "").replace(/_/g, "-")}
                    </SidebarItem>
                  ))
                : null}
            </div>
          );
        })}
      </SidebarSection>

      <SidebarSection label="Teams">
        {demoTeams.map((t) => (
          <SidebarItem key={t.id} to={`/teams/${t.slug}`} icon={<EntityDot color={t.color} />}>
            {t.name}
          </SidebarItem>
        ))}
      </SidebarSection>

      <SidebarSection label="People">
        {demoPeople.map((d) => (
          <SidebarItem key={d.id} to={`/people/${d.slug}`} icon={<EntityDot color={d.avatarColor} />}>
            {d.name}
          </SidebarItem>
        ))}
      </SidebarSection>

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
