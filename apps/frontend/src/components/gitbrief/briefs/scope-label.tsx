import type { BriefResponse } from "@launchstack/api-interfaces";
import { useGetProjects } from "@/hooks/api/use-projects";
import { useGetTeams } from "@/hooks/api/use-teams";
import { useGetCollaborators } from "@/hooks/api/use-collaborators";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { colorFromString, NEUTRAL_DOT_COLOR } from "@/lib/entity-color";

type Scope = BriefResponse["scope"];

interface ResolvedScope {
  dotColor: string;
  label: string;
  prefix: string;
}

function useResolveScope(scope: Scope): ResolvedScope {
  const projectsQuery = useGetProjects();
  const teamsQuery = useGetTeams();
  const collaboratorsQuery = useGetCollaborators();
  const installationsQuery = useGithubInstallations();

  if (scope.type === "project") {
    if (!scope.projectId) {
      return { dotColor: NEUTRAL_DOT_COLOR, label: "(deleted)", prefix: "Project" };
    }
    const project = projectsQuery.data?.data.find((p) => p.id === scope.projectId);
    return {
      dotColor: project?.color ?? NEUTRAL_DOT_COLOR,
      label: project?.name ?? (projectsQuery.isLoading ? "…" : "(deleted)"),
      prefix: "Project",
    };
  }

  if (scope.type === "team") {
    if (!scope.teamId) {
      return { dotColor: NEUTRAL_DOT_COLOR, label: "(deleted)", prefix: "Team" };
    }
    const team = teamsQuery.data?.data.find((t) => t.id === scope.teamId);
    return {
      dotColor: team?.color ?? NEUTRAL_DOT_COLOR,
      label: team?.name ?? (teamsQuery.isLoading ? "…" : "(deleted)"),
      prefix: "Team",
    };
  }

  if (scope.type === "collaborator") {
    if (!scope.collaboratorId) {
      return { dotColor: NEUTRAL_DOT_COLOR, label: "(deleted)", prefix: "Collaborator" };
    }
    const collaborator = collaboratorsQuery.data?.data.find(
      (c) => c.id === scope.collaboratorId,
    );
    return {
      dotColor: collaborator ? colorFromString(collaborator.login) : NEUTRAL_DOT_COLOR,
      label: collaborator?.login ?? (collaboratorsQuery.isLoading ? "…" : "(deleted)"),
      prefix: "Collaborator",
    };
  }

  if (!scope.repositoryId) {
    return { dotColor: NEUTRAL_DOT_COLOR, label: "(deleted)", prefix: "Repository" };
  }
  const repo = installationsQuery.data?.data
    .flatMap((i) => i.repositories)
    .find((r) => r.id === scope.repositoryId);
  return {
    dotColor: NEUTRAL_DOT_COLOR,
    label: repo?.fullName ?? (installationsQuery.isLoading ? "…" : "(deleted)"),
    prefix: "Repository",
  };
}

export function ScopeLabel({ scope }: { scope: Scope }) {
  const resolved = useResolveScope(scope);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <EntityDot color={resolved.dotColor} />
      <span className="text-muted-foreground">{resolved.prefix}:</span>
      <span className="font-medium text-foreground">{resolved.label}</span>
    </span>
  );
}
