import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonList({
  rows = 4,
  rowHeight = 56,
}: {
  rows?: number;
  rowHeight?: number;
}) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full rounded-2xl"
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
}
