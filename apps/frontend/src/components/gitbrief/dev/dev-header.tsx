import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { DemoPerson } from "@/lib/demo-data";
import { getTeamById } from "@/lib/demo-selectors";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function DevHeader({
  dev,
  periodDays,
  onPeriodChange,
}: {
  dev: DemoPerson;
  periodDays: 7 | 30 | 90;
  onPeriodChange: (d: 7 | 30 | 90) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-lg" style={{ background: dev.avatarColor }}>
            {dev.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold">{dev.name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span>@{dev.githubHandle}</span>
            <span>·</span>
            <span>{dev.role}</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {dev.teamIds.map((tid) => {
              const t = getTeamById(tid);
              if (!t) return null;
              return (
                <span key={tid} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  <EntityDot color={t.color} /> {t.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <RadioGroup
        value={String(periodDays)}
        onValueChange={(v) => onPeriodChange(Number(v) as 7 | 30 | 90)}
        className="flex gap-1.5"
      >
        {[{ v: "7", l: "7d" }, { v: "30", l: "30d" }, { v: "90", l: "90d" }].map((o) => (
          <label key={o.v} className="rounded border bg-card px-3 py-1 text-xs cursor-pointer has-[:checked]:bg-foreground has-[:checked]:text-background has-[:checked]:border-transparent">
            <RadioGroupItem value={o.v} className="hidden" /> {o.l}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
