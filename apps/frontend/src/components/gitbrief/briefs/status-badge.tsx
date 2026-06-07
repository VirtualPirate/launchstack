import type { BriefStatus } from "@launchstack/api-interfaces";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<BriefStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  generating: "bg-sky-500/15 text-sky-700 dark:text-sky-300 animate-pulse",
  generated: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<BriefStatus, string> = {
  pending: "Pending",
  generating: "Generating",
  generated: "Generated",
  delivered: "Delivered",
  failed: "Failed",
};

export function StatusBadge({ status, className }: { status: BriefStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
