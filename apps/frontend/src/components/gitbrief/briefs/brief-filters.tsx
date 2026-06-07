import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";
import { cn } from "@/lib/utils";

export interface BriefFiltersValue {
  from: string; // "" or yyyy-mm-dd
  to: string; // "" or yyyy-mm-dd
  excludeNoActivity: boolean;
  repositoryId: string; // "" means all repositories
}

// Radix <SelectItem> forbids an empty-string value, so use a sentinel for the
// "all repositories" option and map it to "" in the change handler.
const ALL_REPOS = "all";

export function BriefFilters({
  value,
  onChange,
  className,
}: {
  value: BriefFiltersValue;
  onChange: (next: BriefFiltersValue) => void;
  className?: string;
}) {
  const installationsQuery = useGithubInstallations();
  const repos = (installationsQuery.data?.data ?? []).flatMap((i) =>
    i.repositories.map((r) => ({ id: r.id, fullName: r.fullName })),
  );

  const hasActive =
    !!value.from ||
    !!value.to ||
    value.excludeNoActivity ||
    !!value.repositoryId;

  const set = (patch: Partial<BriefFiltersValue>) =>
    onChange({ ...value, ...patch });

  return (
    <section className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="brief-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="brief-from"
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => set({ from: e.target.value })}
            className="h-8 w-[150px] text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="brief-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="brief-to"
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => set({ to: e.target.value })}
            className="h-8 w-[150px] text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Repository</Label>
          <Select
            value={value.repositoryId || ALL_REPOS}
            onValueChange={(v) =>
              set({ repositoryId: v === ALL_REPOS ? "" : v })
            }
          >
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="All repositories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_REPOS}>All repositories</SelectItem>
              {repos.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <Switch
            id="brief-exclude-no-activity"
            checked={value.excludeNoActivity}
            onCheckedChange={(checked) => set({ excludeNoActivity: checked })}
          />
          <Label
            htmlFor="brief-exclude-no-activity"
            className="text-xs text-muted-foreground"
          >
            Exclude no activity
          </Label>
        </div>

        {hasActive ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                from: "",
                to: "",
                excludeNoActivity: false,
                repositoryId: "",
              })
            }
            className="pb-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
