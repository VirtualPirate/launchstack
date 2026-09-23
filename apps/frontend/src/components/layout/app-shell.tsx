import { Link, Outlet, useLocation, useMatches } from "@tanstack/react-router";
import { Home, LayoutDashboard, Settings, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeactivatedBanner } from "@/components/organization/deactivated-banner";
import { NoOrganizationGate } from "@/components/organization/no-organization-gate";
import { useMyOrganizations } from "@/hooks/api/use-organizations";
import { useBootstrapActiveOrganization } from "@/hooks/use-bootstrap-active-organization";
import { cn } from "@/lib/utils";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { Topbar } from "./topbar";

const navItems = [
  { icon: Home, label: "Home", to: "/" },
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: Settings, label: "Settings", to: "/settings" },
  { icon: Settings, label: "Organization", to: "/settings/organization" },
  { icon: Users, label: "Members", to: "/settings/organization/members" },
] as const;

/**
 * Reachable without an organization, or the links inside the takeover go
 * dead: the invites list (topbar bell, gate card) and the create page (org
 * switcher). Neither has children, so an exact match is enough.
 */
const NO_ORG_ROUTES = ["/invites", "/organizations/new"];

/** The deepest nav item containing the path, so `/settings` isn't lit on its children. */
function activeNavTarget(pathname: string): string | undefined {
  return navItems
    .map((item) => item.to as string)
    .filter((to) =>
      to === "/"
        ? pathname === "/"
        : pathname === to || pathname.startsWith(`${to}/`),
    )
    .sort((a, b) => b.length - a.length)[0];
}

/** Layout of every protected route: topbar, sidebar, and the page. */
export function AppShell() {
  useBootstrapActiveOrganization();

  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const orgsQuery = useMyOrganizations();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);

  // `isSuccess` keeps pages' own loading states while the list is in flight;
  // `!activeOrgId` closes the gate the moment the create form sets the new
  // org active, before the org list refetch lands.
  const hasNoOrganization =
    orgsQuery.isSuccess && orgsQuery.data.data.length === 0 && !activeOrgId;

  // A full-bleed route manages its own height and scroll. Inside the padded,
  // scrolling container it would get two scroll owners.
  const fullBleed = useMatches().some((m) => m.staticData.fullBleed === true);
  const activeTo = activeNavTarget(pathname);

  return (
    <div className="flex h-screen flex-col">
      <Topbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/*
          `inert`, not aria-hidden + pointer-events-none: those leave the links
          keyboard-focusable, so a user could tab into navigation that goes
          nowhere.
        */}
        <aside
          inert={hasNoOrganization}
          className={cn(
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "fixed inset-y-14 left-0 z-10 w-56 border-r bg-sidebar transition-transform md:static md:translate-x-0",
            hasNoOrganization && "opacity-40",
          )}
        >
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <Button
                key={item.label}
                asChild
                variant={item.to === activeTo ? "secondary" : "ghost"}
                className="justify-start gap-2"
              >
                <Link to={item.to} onClick={() => setSidebarOpen(false)}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <Separator />
          <div className="p-3">
            <p className="px-3 text-xs text-muted-foreground">
              All app routes are protected.
            </p>
          </div>
        </aside>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-9 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main
          className={cn(
            "flex-1",
            fullBleed ? "overflow-hidden" : "overflow-y-auto p-6",
          )}
        >
          {hasNoOrganization && !NO_ORG_ROUTES.includes(pathname) ? (
            <div className="mx-auto w-full max-w-5xl">
              <NoOrganizationGate />
            </div>
          ) : fullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-5xl">
              <DeactivatedBanner />
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
