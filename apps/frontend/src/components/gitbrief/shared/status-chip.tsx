import { cn } from "@/lib/utils";
import type { FeatureStatus } from "@/lib/demo-data";

const styles: Record<FeatureStatus, { label: string; className: string }> = {
  in_flight: { label: "On track",  className: "bg-gb-status-in-flight/10 text-gb-status-in-flight" },
  at_risk:   { label: "At risk",   className: "bg-gb-status-at-risk/10 text-gb-status-at-risk" },
  shipped:   { label: "Shipped",   className: "bg-gb-status-shipped/10 text-gb-status-shipped" },
  on_hold:   { label: "On hold",   className: "bg-muted text-muted-foreground" },
};

export function StatusChip({ status, className }: { status: FeatureStatus; className?: string }) {
  const s = styles[status];
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", s.className, className)}>
      {s.label}
    </span>
  );
}
