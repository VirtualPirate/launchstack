import type { DemoFeature } from "@/lib/demo-data";
import { GitBriefProgressBar } from "@/components/gitbrief/charts/progress-bar";

export function FeatureProgressRow({ feature }: { feature: DemoFeature }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 border-t first:border-t-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <b className="font-medium truncate">{feature.title}</b>
        <span className="text-xs text-muted-foreground shrink-0">
          {feature.status === "shipped"
            ? "shipped"
            : feature.status === "at_risk"
            ? `at risk · ${feature.progress}%`
            : `${feature.progress}%${feature.aiEtaDays ? ` · ${feature.aiEtaDays}d ETA` : ""}`}
        </span>
      </div>
      <GitBriefProgressBar progress={feature.progress} status={feature.status} className="mt-1.5" />
    </div>
  );
}
