import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { PendingInvitesBadge } from "@/components/organization/pending-invites-badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuthSession, useSignOut } from "@/hooks/api/use-auth";
import { CommandTrigger } from "./command-trigger";
import { BrandMark } from "../brand-mark";

export function Topbar() {
  const navigate = useNavigate();
  const sessionQuery = useAuthSession();
  const signOutMutation = useSignOut();

  const userInitial = useMemo(() => {
    const name = sessionQuery.data?.data?.user.name;
    return name ? name.charAt(0).toUpperCase() : "U";
  }, [sessionQuery.data?.data?.user.name]);

  const handleSignOut = async () => {
    await signOutMutation.mutateAsync();
    await navigate({ to: "/sign-in" });
  };

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md backdrop-saturate-150">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight">GitBrief</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <OrgSwitcher />
      </div>

      <div className="flex items-center gap-2">
        <CommandTrigger />
      </div>

      <div className="flex items-center gap-2">
        <PendingInvitesBadge />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signOutMutation.isPending}>
          <LogOut className="size-3.5" />
          <span className="text-xs">Sign out</span>
        </Button>
        <Avatar className="size-7">
          <AvatarFallback className="text-[11px]">{userInitial}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
