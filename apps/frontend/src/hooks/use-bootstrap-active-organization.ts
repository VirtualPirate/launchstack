import { useEffect } from "react";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { useMyOrganizations } from "@/hooks/api/use-organizations";

export function useBootstrapActiveOrganization() {
  const { data, isSuccess, isFetching, isFetchedAfterMount } =
    useMyOrganizations();
  const activeOrganizationId = useActiveOrganizationStore(
    (s) => s.activeOrganizationId,
  );
  const setActiveOrganizationId = useActiveOrganizationStore(
    (s) => s.setActiveOrganizationId,
  );

  // Only a list fetched during this mount, with nothing in flight, may drop the
  // selection: React Query serves the cached list first, and "absent from a
  // stale list" would silently reassign the user to orgs[0].
  const listIsFresh = isFetchedAfterMount && !isFetching;

  useEffect(() => {
    if (!isSuccess || !data?.data) return;
    const orgs = data.data;
    const stillPresent = orgs.some(
      (entry) => entry.organization.id === activeOrganizationId,
    );
    if (activeOrganizationId && !stillPresent) {
      if (listIsFresh) setActiveOrganizationId(null);
      return;
    }
    if (!activeOrganizationId && orgs.length > 0) {
      setActiveOrganizationId(orgs[0].organization.id);
    }
  }, [
    isSuccess,
    listIsFresh,
    data,
    activeOrganizationId,
    setActiveOrganizationId,
  ]);
}
