import { cn } from "@/lib/utils";
import type { WorkType } from "@/lib/demo-data";

const styles: Record<WorkType, { label: string; className: string }> = {
  feature:      { label: "feature",      className: "bg-gb-chart-feature/10 text-gb-chart-feature" },
  optimization: { label: "optimization", className: "bg-gb-chart-optimization/10 text-gb-chart-optimization" },
  refactor:     { label: "refactor",     className: "bg-gb-chart-refactor/10 text-gb-chart-refactor" },
  bug:          { label: "bug",          className: "bg-gb-chart-bug/10 text-gb-chart-bug" },
};

export function WorkTypeTag({ type, className }: { type: WorkType; className?: string }) {
  const s = styles[type];
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", s.className, className)}>
      {s.label}
    </span>
  );
}
