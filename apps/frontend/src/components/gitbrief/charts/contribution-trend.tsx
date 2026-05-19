import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ContributionPoint } from "@/lib/demo-selectors";

export function ContributionTrend({ data, height = 180 }: { data: ContributionPoint[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="weekStart"
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} width={28} />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
          />
          <Line
            type="monotone"
            dataKey="commits"
            stroke="var(--gb-chart-accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--gb-chart-accent)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
