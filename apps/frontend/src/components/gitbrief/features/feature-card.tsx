import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getDeveloperById, getProjectById } from "@/lib/demo-selectors";
import type { DemoFeature } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/gitbrief/shared/status-chip";
import { GitBriefProgressBar } from "@/components/gitbrief/charts/progress-bar";

export function FeatureCard({ feature }: { feature: DemoFeature }) {
  const project = getProjectById(feature.projectId);
  const contributors = feature.contributorIds.map((id) => getDeveloperById(id)).filter(Boolean);

  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors",
      feature.status === "at_risk" && "border-gb-status-at-risk/30",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-snug">{feature.title}</div>
        <StatusChip status={feature.status} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {project?.name}
        {feature.status === "in_flight" && feature.aiEtaDays ? <> · <span className="text-gb-chart-accent">AI: {feature.aiEtaDays}d</span></> : null}
        {feature.status === "shipped" ? <> · <span className="text-gb-status-shipped">shipped</span></> : null}
      </div>
      <GitBriefProgressBar progress={feature.progress} status={feature.status} className="mt-3" />
      <div className="mt-3 flex">
        {contributors.map((c, i) => (
          <Avatar key={c!.id} className={cn("size-5 border-2 border-card", i > 0 && "-ml-1.5")}>
            <AvatarFallback className="text-[9px]" style={{ background: c!.avatarColor }}>
              {c!.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  );
}
