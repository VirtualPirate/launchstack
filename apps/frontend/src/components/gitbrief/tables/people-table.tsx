import { Link } from "@tanstack/react-router";
import { demoPeople } from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { PinToggle } from "@/components/gitbrief/sidebar/pin-toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PeopleTable() {
  const teams = useDemoState((s) => s.teams);
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Name</TableHead>
          <TableHead className="w-[180px]">Role</TableHead>
          <TableHead className="w-[160px]">GitHub</TableHead>
          <TableHead className="w-[220px]">Teams</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {demoPeople.map((p) => {
          const teamNames = p.teamIds
            .map((id) => teamNameById.get(id))
            .filter(Boolean)
            .join(", ");
          return (
            <TableRow key={p.id} className="group">
              <TableCell className="w-8">
                <PinToggle scope="people" id={p.id} />
              </TableCell>
              <TableCell>
                <Link
                  to="/people/$devSlug"
                  params={{ devSlug: p.slug }}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <EntityDot color={p.avatarColor} /> {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm">{p.role}</TableCell>
              <TableCell className="text-sm tabular-nums text-muted-foreground">
                @{p.githubHandle}
              </TableCell>
              <TableCell className="text-sm">
                {teamNames || <span className="text-muted-foreground">—</span>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
