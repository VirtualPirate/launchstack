import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { WorkType } from "@/lib/demo-data";

const COLOR_BY_TYPE: Record<WorkType, string> = {
  feature: "var(--gb-chart-feature)",
  optimization: "var(--gb-chart-optimization)",
  refactor: "var(--gb-chart-refactor)",
  bug: "var(--gb-chart-bug)",
};

const ORDER: WorkType[] = ["feature", "optimization", "refactor", "bug"];
const LABEL: Record<WorkType, string> = {
  feature: "New features",
  optimization: "Optimization",
  refactor: "Refactoring",
  bug: "Bug fixes",
};

export function WorkDistributionDonut({
  distribution,
  size = 140,
}: {
  distribution: Record<WorkType, number>;
  size?: number;
}) {
  const data = ORDER.map((t) => ({ name: LABEL[t], type: t, value: distribution[t] }));
  return (
    <div className="flex items-center gap-5">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="60%"
              outerRadius="100%"
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.type} fill={COLOR_BY_TYPE[d.type]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {data.map((d) => (
          <li key={d.type} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: COLOR_BY_TYPE[d.type] }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
