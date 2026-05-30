import { useEffect } from "react";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { useMyOrganizations } from "@/hooks/api/use-organizations";

export function useBootstrapActiveOrganization() {
  const { data, isSuccess } = useMyOrganizations();
  const activeOrganizationId = useActiveOrganizationStore(
    (s) => s.activeOrganizationId,
  );
  const setActiveOrganizationId = useActiveOrganizationStore(
    (s) => s.setActiveOrganizationId,
  );

  useEffect(() => {
    if (!isSuccess || !data?.data) return;
    const orgs = data.data;
    const stillPresent = orgs.some(
      (entry) => entry.organization.id === activeOrganizationId,
    );
    if (activeOrganizationId && !stillPresent) {
      setActiveOrganizationId(null);
      return;
    }
    if (!activeOrganizationId && orgs.length > 0) {
      setActiveOrganizationId(orgs[0].organization.id);
    }
  }, [isSuccess, data, activeOrganizationId, setActiveOrganizationId]);
}
