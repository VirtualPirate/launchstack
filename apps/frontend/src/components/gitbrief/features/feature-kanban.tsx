import { DEMO_NOW, type DemoFeature, type FeatureStatus } from "@/lib/demo-data";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { FeatureCard } from "./feature-card";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";

const COLUMNS: { status: FeatureStatus; title: string; tone?: string }[] = [
  { status: "in_flight", title: "In flight" },
  { status: "at_risk",   title: "At risk", tone: "text-gb-status-at-risk" },
  { status: "shipped",   title: "Shipped (7d)", tone: "text-gb-status-shipped" },
];

export function FeatureKanban({ features }: { features: DemoFeature[] }) {
  const sevenDaysAgo = DEMO_NOW.getTime() - 7 * 86400000;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = features.filter((f) => {
          if (col.status !== "shipped") return f.status === col.status;
          return f.status === "shipped" && f.shippedAt && new Date(f.shippedAt).getTime() >= sevenDaysAgo;
        });
        return (
          <div key={col.status} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionLabel className={col.tone}>{col.title}</SectionLabel>
              <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            {items.length === 0
              ? <EmptyState title="Nothing here" />
              : items.map((f) => <FeatureCard key={f.id} feature={f} />)}
          </div>
        );
      })}
    </div>
  );
}
