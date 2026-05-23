import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SidebarItem({
  to,
  icon,
  children,
  count,
  exact,
  indent,
  trailing,
}: {
  to: string;
  icon?: ReactNode;
  children: ReactNode;
  count?: number;
  exact?: boolean;
  indent?: boolean;
  trailing?: ReactNode;
}) {
  const location = useLocation();
  const active = exact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md transition-colors",
        "hover:bg-sidebar-accent",
        active && "bg-sidebar-accent",
      )}
    >
      <Link
        to={to}
        className={cn(
          "flex flex-1 items-center gap-2 px-2 py-1 text-[13px] text-sidebar-foreground/80",
          "hover:text-sidebar-foreground",
          active && "text-sidebar-foreground",
          indent && "pl-7 text-[12px] text-sidebar-foreground/60",
        )}
      >
        {icon ? (
          <span className="inline-flex size-4 items-center justify-center text-sidebar-foreground/60">
            {icon}
          </span>
        ) : null}
        <span className="flex-1 truncate">{children}</span>
        {typeof count === "number" ? (
          <span className="rounded-full bg-sidebar-accent/60 px-1.5 text-[10px] text-sidebar-foreground/70">
            {count}
          </span>
        ) : null}
      </Link>
      {trailing ? <div className="pr-1">{trailing}</div> : null}
    </div>
  );
}
