import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-block size-[26px] shrink-0 rounded-md bg-foreground",
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-[6px] rounded-[2px] bg-background" />
    </span>
  );
}
