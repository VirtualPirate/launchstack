import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { demoPeople, type DemoTeam } from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";
import { cn } from "@/lib/utils";

const TEAM_COLORS = [
  "oklch(0.62 0.18 277)",
  "oklch(0.75 0.16 70)",
  "oklch(0.72 0.18 145)",
  "oklch(0.62 0.22 305)",
  "oklch(0.68 0.22 25)",
  "oklch(0.66 0.16 200)",
  "oklch(0.70 0.15 330)",
  "oklch(0.70 0.15 180)",
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NewTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const teams = useDemoState((s) => s.teams);
  const addTeam = useDemoState((s) => s.addTeam);

  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]!);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const slug = useMemo(() => toSlug(name), [name]);
  const trimmedName = name.trim();
  const slugCollision = useMemo(
    () => slug.length > 0 && teams.some((t) => t.slug === slug),
    [slug, teams],
  );

  const canSubmit = trimmedName.length > 0 && trimmedName.length <= 60 && !slugCollision;

  const resetForm = () => {
    setName("");
    setColor(TEAM_COLORS[0]!);
    setMemberIds([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const newTeam: DemoTeam = {
      id: `team_${Date.now()}`,
      slug,
      name: trimmedName,
      color,
      memberIds,
    };
    addTeam(newTeam);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
          <DialogDescription>
            Group developers you want to track and brief together.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[60vh] space-y-5 overflow-y-auto px-1.5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Backend"
              maxLength={60}
              autoFocus
            />
            {slugCollision ? (
              <p className="text-xs text-destructive" role="alert">
                A team with this name already exists.
              </p>
            ) : null}
          </div>

          <div className="border-t pt-4">
            <SectionLabel>Color</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full transition-transform",
                    color === c
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "hover:scale-110",
                  )}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Members</SectionLabel>
              <span className="text-[10px] text-muted-foreground">
                {memberIds.length} of {demoPeople.length} selected
              </span>
            </div>
            <div className="mt-2 max-h-64 overflow-y-auto rounded border bg-background">
              {demoPeople.map((person) => {
                const checked = memberIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleMember(person.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/50",
                      checked && "bg-accent/30",
                    )}
                    aria-pressed={checked}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-4 items-center justify-center rounded border",
                          checked
                            ? "border-foreground bg-foreground text-background"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                      <EntityDot color={person.avatarColor} />
                      {person.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {person.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
