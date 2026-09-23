import { useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, Rocket, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { PendingInvitesBadge } from "@/components/organization/pending-invites-badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  clearSignedOutUserState,
  useAuthSession,
  useSignOut,
} from "@/hooks/api/use-auth";

export function Topbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const navigate = useNavigate();
  const signOutMutation = useSignOut();
  const userName = useAuthSession().data?.data?.user.name;
  const userInitial = userName ? userName.charAt(0).toUpperCase() : "U";

  const handleSignOut = async () => {
    await signOutMutation.mutateAsync();
    await navigate({ to: "/sign-in" });
    clearSignedOutUserState();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          onClick={onToggleSidebar}
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
  );
}
