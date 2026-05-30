import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { PendingInvitesBadge } from "@/components/organization/pending-invites-badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuthSession, useSignOut } from "@/hooks/api/use-auth";
import { useBootstrapActiveOrganization } from "@/hooks/use-bootstrap-active-organization";

const navItems = [
  { icon: Home, label: "Home", to: "/" },
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: Settings, label: "Settings", to: "/settings" },
  { icon: Settings, label: "Organization", to: "/settings/organization" },
  { icon: Users, label: "Members", to: "/settings/organization/members" },
] as const;

function App() {
  useBootstrapActiveOrganization();

  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const signOutMutation = useSignOut();
  const sessionQuery = useAuthSession();

  const userInitial = useMemo(() => {
    const userName = sessionQuery.data?.data?.user.name;
    if (!userName) {
      return "U";
    }
    return userName.charAt(0).toUpperCase();
  }, [sessionQuery.data?.data?.user.name]);

  const handleSignOut = async () => {
    await signOutMutation.mutateAsync();
    await navigate({ to: "/sign-in" });
  };

  const isRouteActive = (to: string) => {
    if (to === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(to);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen((current) => !current)}
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
          <Rocket className="size-5" />
          <span className="text-lg font-semibold tracking-tight">LaunchStack</span>
          <div className="ml-4">
            <OrgSwitcher />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PendingInvitesBadge />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signOutMutation.isPending}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-14 left-0 z-10 w-56 border-r bg-sidebar transition-transform md:static md:translate-x-0`}
        >
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <Button
                key={item.label}
                asChild
                variant={isRouteActive(item.to) ? "secondary" : "ghost"}
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

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
