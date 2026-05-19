import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { DemoActivity } from "@/lib/demo-data";
import { formatRelative } from "@/lib/demo-selectors";
import { getDeveloperById, getProjectById, getRepoById } from "@/lib/demo-selectors";
import { WorkTypeTag } from "@/components/gitbrief/shared/work-type-tag";

const verbByKind: Record<DemoActivity["kind"], string> = {
  commit: "committed to",
  pr_opened: "opened PR",
  pr_merged: "merged PR",
  feature_shipped: "shipped",
  bug_fix: "fixed",
  refactor: "refactored",
};

export function ActivityItem({ activity }: { activity: DemoActivity }) {
  const actor = getDeveloperById(activity.actorId);
  const project = getProjectById(activity.projectId);
  const repo = getRepoById(activity.repoId);
  if (!actor || !project || !repo) return null;

  return (
    <li className="flex gap-3 px-4 py-3 hover:bg-accent/40">
      <Avatar className="size-6 mt-0.5 shrink-0">
        <AvatarFallback className="text-[10px]" style={{ background: actor.avatarColor }}>
          {actor.name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <Link to="/people/$devSlug" params={{ devSlug: actor.slug }} className="font-medium hover:underline">
            {actor.name}
          </Link>
          <span className="text-muted-foreground">{verbByKind[activity.kind]}</span>
          <span className="font-medium">{activity.target}</span>
          <WorkTypeTag type={activity.workType} />
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          <Link to="/projects/$projectSlug" params={{ projectSlug: project.slug }} className="hover:underline">{project.name}</Link>
          {" · "}
          <span>{repo.name}</span>
          {activity.additions != null ? (
            <>
              {" · "}
              <span className="text-gb-status-shipped">+{activity.additions}</span>{" "}
              <span className="text-gb-status-at-risk">−{activity.deletions ?? 0}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">{formatRelative(activity.timestamp)}</div>
    </li>
  );
}
