import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type {
  CreateOrganizationRequest,
  TransferOwnershipRequest,
  UpdateOrganizationRequest,
} from "@launchstack/api-interfaces";
import { OrganizationsAPI } from "@/api/organizations.api";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export const organizationsKeys = {
  me: ["organizations", "me"] as const,
  current: (activeOrgId: string | null) =>
    ["organizations", "current", activeOrgId] as const,
};

export function useMyOrganizations() {
  return useQuery({
    queryKey: organizationsKeys.me,
    queryFn: () => OrganizationsAPI.listMine(),
  });
}

export function useCurrentOrganization() {
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useQuery({
    queryKey: organizationsKeys.current(activeOrgId),
    queryFn: () => OrganizationsAPI.getCurrent(),
    enabled: !!activeOrgId,
  });
}

/**
 * After the active org is deleted or left: select another from a freshly
 * fetched list and go home, or go create one. Staying put would re-render the
 * page against whatever org the bootstrap hook swaps in, or load forever.
 */
export function useExitActiveOrganization() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);

  return async (goneOrgId: string) => {
    // fetchQuery, not the cache: the cached list may predate the delete/leave.
    const list = await queryClient.fetchQuery({
      queryKey: organizationsKeys.me,
      queryFn: () => OrganizationsAPI.listMine(),
    });
    const nextOrgId =
      list.data.find((entry) => entry.organization.id !== goneOrgId)
        ?.organization.id ?? null;
    setActive(nextOrgId);
    await navigate({ to: nextOrgId ? "/" : "/organizations/new" });
  };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationRequest) =>
      OrganizationsAPI.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
    },
  });
}

export function useUpdateCurrentOrganization() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (payload: UpdateOrganizationRequest) =>
      OrganizationsAPI.updateCurrent(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
      await queryClient.invalidateQueries({
        queryKey: organizationsKeys.current(activeOrgId),
      });
    },
  });
}

export function useDeleteCurrentOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => OrganizationsAPI.deleteCurrent(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
    },
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (payload: TransferOwnershipRequest) =>
      OrganizationsAPI.transferOwnership(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationsKeys.me });
      await queryClient.invalidateQueries({
        queryKey: organizationsKeys.current(activeOrgId),
      });
    },
  });
}
