import { useState } from "react";
import { demoProjects, demoRepos } from "@/lib/demo-data";
import { getProjectById, formatRelative } from "@/lib/demo-selectors";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";

export function ReposTable() {
  const [filterProject, setFilterProject] = useState<string>("all");
  const repos = filterProject === "all" ? demoRepos : demoRepos.filter((r) => r.projectId === filterProject);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Project:</span>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-7 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {demoProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repository</TableHead>
            <TableHead className="w-[160px]">Project</TableHead>
            <TableHead className="w-[140px]">Last commit</TableHead>
            <TableHead className="w-[100px]">Open PRs</TableHead>
            <TableHead className="w-[140px]">Language</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repos.map((r) => {
            const p = getProjectById(r.projectId);
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">{r.name}</TableCell>
                <TableCell className="text-sm">
                  {p ? (
                    <span className="inline-flex items-center gap-1.5">
                      <EntityDot color={p.color} /> {p.name}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-sm">{formatRelative(r.lastCommitAt)}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.openPrCount}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.primaryLanguage}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
