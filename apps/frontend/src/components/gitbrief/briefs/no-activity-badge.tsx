import { Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NoActivityBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <Moon className="size-3" />
      No activity
    </span>
  );
}
