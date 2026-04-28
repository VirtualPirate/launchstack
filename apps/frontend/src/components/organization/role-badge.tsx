import type { OrganizationRole } from "@launchstack/api-interfaces";
import { Badge } from "@/components/ui/badge";

const variants: Record<
  OrganizationRole,
  "default" | "secondary" | "outline"
> = {
  owner: "default",
  admin: "secondary",
  viewer: "outline",
};

export function RoleBadge({ role }: { role: OrganizationRole }) {
  return (
    <Badge variant={variants[role]} className="capitalize">
      {role}
    </Badge>
  );
}
