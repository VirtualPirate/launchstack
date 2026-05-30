import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyOrganizations } from "@/hooks/api/use-organizations";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { RoleBadge } from "./role-badge";

export function OrgSwitcher() {
  const navigate = useNavigate();
  const { data } = useMyOrganizations();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  const setActiveOrgId = useActiveOrganizationStore(
    (s) => s.setActiveOrganizationId,
  );

  const orgs = data?.data ?? [];
  const active = useMemo(
    () => orgs.find((o) => o.organization.id === activeOrgId) ?? null,
    [orgs, activeOrgId],
  );

  if (orgs.length === 0) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/organizations/new">
          <Plus className="size-4" />
          Create organization
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="size-4" />
          <span className="max-w-[12ch] truncate">
            {active?.organization.name ?? "Select org"}
          </span>
          {active ? <RoleBadge role={active.role} /> : null}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {orgs.map((entry) => (
          <DropdownMenuItem
            key={entry.organization.id}
            onSelect={() => setActiveOrgId(entry.organization.id)}
          >
            <span className="flex-1 truncate">{entry.organization.name}</span>
            <RoleBadge role={entry.role} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/organizations/new" })}>
          <Plus className="size-4" />
          Create new organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
