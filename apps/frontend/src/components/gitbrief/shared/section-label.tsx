import { cn } from "@/lib/utils";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground", className)}>
      {children}
    </div>
  );
}
