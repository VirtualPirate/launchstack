import { cn } from "@/lib/utils";

export function WizardStepper({
  steps,
  current,
}: {
  steps: { title: string; description?: string }[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={i} className="flex items-center gap-2">
            <span
              className={cn(
                "size-5 rounded-full border flex items-center justify-center text-[10px] font-medium",
                state === "active" && "border-foreground bg-foreground text-background",
                state === "done" && "border-gb-status-shipped bg-gb-status-shipped/20 text-gb-status-shipped",
                state === "pending" && "text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={cn(state === "pending" && "text-muted-foreground")}>{s.title}</span>
            {i < steps.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
