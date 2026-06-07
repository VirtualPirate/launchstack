import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Team } from "@launchstack/api-interfaces";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useGetCollaborators } from "@/hooks/api/use-collaborators";
import { useSetTeamCollaborators } from "@/hooks/api/use-teams";

export function CollaboratorPicker({
  open,
  onOpenChange,
  team,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
}) {
  const collaboratorsQuery = useGetCollaborators();
  const mutation = useSetTeamCollaborators(team.id);

  const [selected, setSelected] = useState<Set<string>>(new Set(team.collaboratorIds));
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set(team.collaboratorIds));
      setSearch("");
      setSubmitError(null);
    }
  }, [open, team.collaboratorIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const all = collaboratorsQuery.data?.data ?? [];
  const filtered = all.filter((c) =>
    c.login.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    setSubmitError(null);
    try {
      await mutation.mutateAsync({ collaboratorIds: Array.from(selected) });
      toast.success("Collaborators updated");
      onOpenChange(false);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage collaborators</DialogTitle>
          <DialogDescription>
            Pick GitHub collaborators reachable from your org.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by login…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {collaboratorsQuery.isError ? (
          <ErrorState
            message={extractErrorMessage(collaboratorsQuery.error)}
            onRetry={() => collaboratorsQuery.refetch()}
          />
        ) : (
          <ScrollArea className="h-72 rounded-md border">
            <ul className="divide-y">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {collaboratorsQuery.isLoading ? "Loading…" : "No collaborators match."}
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Checkbox
                      id={`collab-${c.id}`}
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    <Avatar className="size-5">
                      {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={c.login} /> : null}
                      <AvatarFallback className="text-[9px]">
                        {c.login.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor={`collab-${c.id}`} className="flex-1 cursor-pointer">
                      <span className="font-medium">{c.login}</span>
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
            Save {selected.size} collaborator{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
