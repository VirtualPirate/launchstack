import type { ReactNode } from "react";

export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      {label ? (
        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70">
          {label}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
