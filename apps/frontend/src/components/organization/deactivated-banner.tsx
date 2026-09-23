import { Lock } from "lucide-react";
import { useCurrentOrganization } from "@/hooks/api/use-organizations";

/**
 * Explains why writes answer 403 `ORG_DEACTIVATED`. The backend enforces the
 * freeze (OrgDeactivationGuard); controls stay enabled so the two checks
 * can't drift apart.
 */
export function DeactivatedBanner() {
  const { data } = useCurrentOrganization();
  if (!data?.data.organization.deactivatedAt) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
      <div>
        <p className="font-medium">This organization is read-only.</p>
        <p className="text-muted-foreground">
          Everything here stays visible, and you can still manage the
          organization and its members. Contact support to turn it back on.
        </p>
      </div>
    </div>
  );
}
