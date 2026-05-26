import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScheduledBriefRow } from "@/components/gitbrief/briefs/scheduled-brief-row";
import { useDemoState } from "@/stores/demo-state";

export function BriefsScheduledPage() {
  const schedules = useDemoState((s) => s.schedules);

  return (
    <>
      <PageHeader
        title="Scheduled briefs"
        description="Recurring briefs delivered to dashboard, email, or Slack."
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/briefs">
                <ArrowLeft className="size-3.5" /> Back to briefs
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/briefs/new">
                <Plus className="size-3.5" /> New brief
              </Link>
            </Button>
          </>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState
          title="No scheduled briefs yet"
          description="Create a recurring brief to track a project, team, or person on a regular cadence."
          action={
            <Button asChild size="sm">
              <Link to="/briefs/new">Create your first scheduled brief</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Last sent</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <ScheduledBriefRow key={s.id} schedule={s} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
