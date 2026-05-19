import { MoreHorizontal, Pause, Play, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatRelative } from "@/lib/demo-selectors";
import { useDemoState } from "@/stores/demo-state";
import type { DemoSchedule } from "@/lib/demo-data";
import { ScopeLabel } from "./scope-label";

function cadenceLabel(s: DemoSchedule): string {
  const c = s.cadence;
  if (c.type === "daily") return `Daily · ${c.time}`;
  if (c.type === "weekly") return `Weekly · ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][c.day]} ${c.time}`;
  return `Monthly · day ${c.dayOfMonth} ${c.time}`;
}

function deliveryLabel(s: DemoSchedule): string {
  return s.delivery.map((d) =>
    d.type === "dashboard" ? "Dashboard" : d.type === "email" ? "Email" : `Slack ${d.channel}`,
  ).join(" · ");
}

export function ScheduledBriefRow({ schedule }: { schedule: DemoSchedule }) {
  const navigate = useNavigate();
  const pauseSchedule = useDemoState((s) => s.pauseSchedule);
  const deleteSchedule = useDemoState((s) => s.deleteSchedule);

  return (
    <TableRow>
      <TableCell className="text-sm font-medium">
        {schedule.name}
        <div className="mt-0.5 text-xs text-muted-foreground"><ScopeLabel scope={schedule.scope} /></div>
      </TableCell>
      <TableCell className="text-sm">{cadenceLabel(schedule)}</TableCell>
      <TableCell className="text-sm">{schedule.paused ? <span className="text-muted-foreground">paused</span> : formatRelative(schedule.nextRunAt)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{deliveryLabel(schedule)}</TableCell>
      <TableCell className="text-sm">{schedule.lastSentAt ? formatRelative(schedule.lastSentAt) : "—"}</TableCell>
      <TableCell className="w-[40px]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate({ to: "/briefs/new", search: { editId: schedule.id } })}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pauseSchedule(schedule.id)}>
              {schedule.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {schedule.paused ? "Resume" : "Pause"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteSchedule(schedule.id)} className="text-destructive">
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
