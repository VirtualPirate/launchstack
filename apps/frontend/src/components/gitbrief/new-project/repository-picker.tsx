import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Project } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ErrorState,
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";
import { useSetProjectRepositories } from "@/hooks/api/use-projects";

export function RepositoryPicker({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const installationsQuery = useGithubInstallations();
  const mutation = useSetProjectRepositories(project.id);

  const allRepos = useMemo(() => {
    return (installationsQuery.data?.data ?? []).flatMap((i) =>
      i.repositories.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        accountLogin: i.accountLogin,
      })),
    );
  }, [installationsQuery.data]);

  const [selected, setSelected] = useState<Set<string>>(new Set(project.repositoryIds));
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set(project.repositoryIds));
      setSearch("");
      setSubmitError(null);
    }
  }, [open, project.repositoryIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRepos = allRepos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    setSubmitError(null);
    try {
      await mutation.mutateAsync({ repositoryIds: Array.from(selected) });
      toast.success("Repositories updated");
      onOpenChange(false);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage repositories</DialogTitle>
          <DialogDescription>
            Select which repositories belong to {project.name}.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {installationsQuery.isError ? (
          <ErrorState
            message={extractErrorMessage(installationsQuery.error)}
            onRetry={() => installationsQuery.refetch()}
          />
        ) : (
          <ScrollArea className="h-72 rounded-md border">
            <ul className="divide-y">
              {filteredRepos.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No repositories match.
                </li>
              ) : (
                filteredRepos.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Checkbox
                      id={`repo-${r.id}`}
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                    />
                    <label htmlFor={`repo-${r.id}`} className="flex-1 cursor-pointer">
                      <span className="font-medium">{r.fullName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.accountLogin}
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        )}

        {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            Save {selected.size} repositor{selected.size === 1 ? "y" : "ies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
