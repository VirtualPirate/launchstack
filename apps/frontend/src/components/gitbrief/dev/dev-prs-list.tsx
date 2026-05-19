import type { DemoActivity } from "@/lib/demo-data";
import { formatRelative, getProjectById, getRepoById } from "@/lib/demo-selectors";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DevPrsList({ prs }: { prs: DemoActivity[] }) {
  if (prs.length === 0) {
    return <p className="text-sm text-muted-foreground">No PRs in this period.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead className="w-[160px]">Repo</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[120px]">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prs.map((a) => {
          const repo = getRepoById(a.repoId);
          const project = getProjectById(a.projectId);
          return (
            <TableRow key={a.id}>
              <TableCell className="text-sm font-medium">{a.target}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{project?.name} · {repo?.name}</TableCell>
              <TableCell className="text-xs">{a.kind === "pr_merged" ? <span className="text-gb-status-shipped">merged</span> : <span>open</span>}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatRelative(a.timestamp)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
