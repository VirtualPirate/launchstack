import type { BriefScope } from "@/lib/demo-data";
import { getDeveloperById, getProjectById, getRepoById, getTeamById } from "@/lib/demo-selectors";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";

export function ScopeLabel({ scope }: { scope: BriefScope }) {
  if (scope.type === "project") {
    const p = getProjectById(scope.projectId);
    return p ? <span className="inline-flex items-center gap-1.5"><EntityDot color={p.color} /> Project · {p.name}</span> : null;
  }
  if (scope.type === "team") {
    const t = getTeamById(scope.teamId);
    return t ? <span className="inline-flex items-center gap-1.5"><EntityDot color={t.color} /> Team · {t.name}</span> : null;
  }
  if (scope.type === "developer") {
    const d = getDeveloperById(scope.devId);
    return d ? <span className="inline-flex items-center gap-1.5"><EntityDot color={d.avatarColor} /> {d.name}</span> : null;
  }
  const r = getRepoById(scope.repoId);
  return r ? <span>Repo · {r.name}</span> : null;
}
