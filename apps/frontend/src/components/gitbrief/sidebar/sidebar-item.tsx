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
}: {
  to: string;
  icon?: ReactNode;
  children: ReactNode;
  count?: number;
  exact?: boolean;
  indent?: boolean;
}) {
  const location = useLocation();
  const active = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-sidebar-foreground/80 transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
        active && "bg-sidebar-accent text-sidebar-foreground",
        indent && "pl-7 text-[12px] text-sidebar-foreground/60",
      )}
    >
      {icon ? <span className="inline-flex size-4 items-center justify-center text-sidebar-foreground/60">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
      {typeof count === "number" ? (
        <span className="rounded-full bg-sidebar-accent/60 px-1.5 text-[10px] text-sidebar-foreground/70">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
