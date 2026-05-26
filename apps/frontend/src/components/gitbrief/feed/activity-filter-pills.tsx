import { cn } from "@/lib/utils";

export type FeedFilter = "all" | "shipped" | "prs" | "bugs" | "refactors" | "optimizations";

const OPTIONS: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "shipped", label: "Shipped" },
  { value: "prs", label: "PRs" },
  { value: "bugs", label: "Bugs" },
  { value: "refactors", label: "Refactors" },
  { value: "optimizations", label: "Optimizations" },
];

export function ActivityFilterPills({
  value,
  onChange,
}: {
  value: FeedFilter;
  onChange: (v: FeedFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            value === o.value
              ? "bg-foreground text-background border-transparent"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
