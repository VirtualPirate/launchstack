import { cn } from "@/lib/utils";
import type { FeatureStatus } from "@/lib/demo-data";

const toneByStatus: Record<FeatureStatus, string> = {
  in_flight: "bg-gb-status-in-flight",
  at_risk: "bg-gb-status-at-risk",
  shipped: "bg-gb-status-shipped",
  on_hold: "bg-gb-status-on-hold",
};

export function GitBriefProgressBar({
  progress,
  status,
  className,
}: {
  progress: number;
  status: FeatureStatus;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full transition-all", toneByStatus[status])} style={{ width: `${clamped}%` }} />
    </div>
  );
}
