import { Link } from "@tanstack/react-router";
import { CalendarClock, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import {
  ErrorState,
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { SkeletonList } from "@/components/gitbrief/shared/skeleton-list";
import { ScopeLabel } from "@/components/gitbrief/briefs/scope-label";
import {
  useGetBriefSchedules,
  usePauseBriefSchedule,
  useResumeBriefSchedule,
} from "@/hooks/api/use-brief-schedules";
import { cadenceLabel, formatTimestamp } from "@/lib/cadence-label";

export function SchedulesPage() {
  const schedulesQuery = useGetBriefSchedules();
  const pauseMutation = usePauseBriefSchedule();
  const resumeMutation = useResumeBriefSchedule();

  const handleToggle = async (id: string, paused: boolean) => {
    try {
      if (paused) {
        await resumeMutation.mutateAsync(id);
        toast.success("Schedule resumed");
      } else {
        await pauseMutation.mutateAsync(id);
        toast.success("Schedule paused");
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Schedules"
        description="Recurring briefs configured for your organization."
        actions={
          <Button asChild size="sm">
            <Link to="/schedules/new">
              <Plus className="size-3.5" /> New schedule
            </Link>
          </Button>
        }
      />

      {schedulesQuery.isLoading ? (
        <SkeletonList rows={4} />
      ) : schedulesQuery.isError ? (
        <ErrorState
          message={extractErrorMessage(schedulesQuery.error)}
          onRetry={() => schedulesQuery.refetch()}
        />
      ) : schedulesQuery.data?.data.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-6" />}
          title="No schedules yet"
          description="Create a schedule so briefs land in your inbox on a cadence."
          action={
            <Button asChild size="sm">
              <Link to="/schedules/new">
                <Plus className="size-3.5" /> New schedule
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Last sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulesQuery.data?.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      to="/schedules/$scheduleId"
                      params={{ scheduleId: s.id }}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ScopeLabel scope={s.scope} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cadenceLabel(s)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTimestamp(s.nextRunAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTimestamp(s.lastSentAt)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.paused
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {s.paused ? "Paused" : "Active"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggle(s.id, s.paused)}
                      disabled={pauseMutation.isPending || resumeMutation.isPending}
                    >
                      {s.paused ? (
                        <>
                          <Play className="size-3.5" /> Resume
                        </>
                      ) : (
                        <>
                          <Pause className="size-3.5" /> Pause
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
