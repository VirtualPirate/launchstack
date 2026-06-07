import type { ScopeInput } from "@launchstack/api-interfaces";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { useGetProjects } from "@/hooks/api/use-projects";
import { useGetTeams } from "@/hooks/api/use-teams";
import { useGetCollaborators } from "@/hooks/api/use-collaborators";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";

export type ScopeType = ScopeInput["type"];

export function ScopePicker({
  value,
  onChange,
}: {
  value: ScopeInput | null;
  onChange: (next: ScopeInput | null) => void;
}) {
  const projectsQuery = useGetProjects();
  const teamsQuery = useGetTeams();
  const collaboratorsQuery = useGetCollaborators();
  const installationsQuery = useGithubInstallations();

  const handleTypeChange = (next: ScopeType) => {
    if (next === "project") {
      const firstId = projectsQuery.data?.data[0]?.id;
      onChange(firstId ? { type: "project", projectId: firstId } : null);
    } else if (next === "team") {
      const firstId = teamsQuery.data?.data[0]?.id;
      onChange(firstId ? { type: "team", teamId: firstId } : null);
    } else if (next === "collaborator") {
      const firstId = collaboratorsQuery.data?.data[0]?.id;
      onChange(firstId ? { type: "collaborator", collaboratorId: firstId } : null);
    } else {
      const firstId = installationsQuery.data?.data.flatMap((i) => i.repositories)[0]?.id;
      onChange(firstId ? { type: "repository", repositoryId: firstId } : null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Scope type</Label>
        <RadioGroup
          value={value?.type ?? "project"}
          onValueChange={(v) => handleTypeChange(v as ScopeType)}
          className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {(["project", "team", "collaborator", "repository"] as ScopeType[]).map((t) => (
            <Label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize"
            >
              <RadioGroupItem value={t} />
              {t}
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label className="text-xs">Entity</Label>
        {value?.type === "project" ? (
          <Select
            value={value.projectId}
            onValueChange={(id) => onChange({ type: "project", projectId: id })}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {(projectsQuery.data?.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="inline-flex items-center gap-2">
                    <EntityDot color={p.color ?? "var(--muted-foreground)"} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : value?.type === "team" ? (
          <Select
            value={value.teamId}
            onValueChange={(id) => onChange({ type: "team", teamId: id })}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {(teamsQuery.data?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-2">
                    <EntityDot color={t.color ?? "var(--muted-foreground)"} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : value?.type === "collaborator" ? (
          <Select
            value={value.collaboratorId}
            onValueChange={(id) =>
              onChange({ type: "collaborator", collaboratorId: id })
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a collaborator" />
            </SelectTrigger>
            <SelectContent>
              {(collaboratorsQuery.data?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <Avatar className="size-4">
                      {c.avatarUrl ? (
                        <AvatarImage src={c.avatarUrl} alt={c.login} />
                      ) : null}
                      <AvatarFallback className="text-[8px]">
                        {c.login.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {c.login}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={value?.type === "repository" ? value.repositoryId : ""}
            onValueChange={(id) =>
              onChange({ type: "repository", repositoryId: id })
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a repository" />
            </SelectTrigger>
            <SelectContent>
              {(installationsQuery.data?.data ?? []).flatMap((i) =>
                i.repositories.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { deriveScopeName } from "@/lib/scope-name";
