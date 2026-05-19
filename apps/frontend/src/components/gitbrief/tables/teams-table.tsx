import { Link } from "@tanstack/react-router";
import { demoTeams } from "@/lib/demo-data";
import { getFeaturesForScope } from "@/lib/demo-selectors";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TeamsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead className="w-[100px]">Members</TableHead>
          <TableHead className="w-[160px]">Active features</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {demoTeams.map((t) => {
          const features = getFeaturesForScope({ teamId: t.id });
          const active = features.filter((f) => f.status !== "shipped").length;
          return (
            <TableRow key={t.id}>
              <TableCell>
                <Link to="/teams/$teamSlug" params={{ teamSlug: t.slug }} className="flex items-center gap-2 font-medium hover:underline">
                  <EntityDot color={t.color} /> {t.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm tabular-nums">{t.memberIds.length}</TableCell>
              <TableCell className="text-sm tabular-nums">{active}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
