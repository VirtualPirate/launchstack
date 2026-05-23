import { Link } from "@tanstack/react-router";
import { demoProjects } from "@/lib/demo-data";
import { getFeaturesForScope, getProjectHealth } from "@/lib/demo-selectors";
import { useDemoState } from "@/stores/demo-state";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { PinToggle } from "@/components/gitbrief/sidebar/pin-toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ProjectsTable() {
  const schedules = useDemoState((s) => s.schedules);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Project</TableHead>
          <TableHead className="w-[120px]">Health</TableHead>
          <TableHead className="w-[140px]">Active features</TableHead>
          <TableHead className="w-[180px]">Last shipped</TableHead>
          <TableHead className="w-[180px]">Brief</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {demoProjects.map((p) => {
          const features = getFeaturesForScope({ projectId: p.id });
          const active = features.filter((f) => f.status === "in_flight" || f.status === "at_risk").length;
          const last = features
            .filter((f) => f.status === "shipped" && f.shippedAt)
            .sort((a, b) => (a.shippedAt! < b.shippedAt! ? 1 : -1))[0];
          const sched = schedules.find((s) => s.scope.type === "project" && s.scope.projectId === p.id);
          const health = getProjectHealth(p.id);

          return (
            <TableRow key={p.id} className="group cursor-pointer">
              <TableCell className="w-8">
                <PinToggle scope="projects" id={p.id} />
              </TableCell>
              <TableCell>
                <Link to="/projects/$projectSlug" params={{ projectSlug: p.slug }} className="flex items-center gap-2 font-medium hover:underline">
                  <EntityDot color={p.color} /> {p.name}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums">{health}%</span>
                  <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gb-status-in-flight" style={{ width: `${health}%` }} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm tabular-nums">{active}</TableCell>
              <TableCell className="text-sm">
                {last ? last.title : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-sm">
                {sched ? (
                  <span className={sched.paused ? "text-muted-foreground" : ""}>
                    {sched.paused ? "paused" : sched.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">none</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
