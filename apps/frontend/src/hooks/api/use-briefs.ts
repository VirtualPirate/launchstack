import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  BriefStatus,
  GenerateBriefRequest,
  ListBriefsQuery,
} from "@launchstack/api-interfaces";
import { BriefsAPI } from "@/api/briefs.api";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

const POLL_STATUSES: ReadonlyArray<BriefStatus> = [
  "pending",
  "generating",
  "generated",
];

export type BriefListFilters = Omit<ListBriefsQuery, "cursor" | "limit"> & {
  limit?: number;
};

export const briefsKeys = {
  list: (orgId: string | null, filters: BriefListFilters) =>
    ["briefs", "list", orgId, filters] as const,
  detail: (orgId: string | null, briefId: string) =>
    ["briefs", "detail", orgId, briefId] as const,
};

export function useGetBriefs(filters: BriefListFilters = {}) {
  const orgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  const limit = filters.limit ?? 20;
  return useInfiniteQuery({
    queryKey: briefsKeys.list(orgId, filters),
    enabled: !!orgId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      BriefsAPI.list({ ...filters, limit, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
  });
}

export function useGetBriefsFirstPage(filters: BriefListFilters = {}) {
  const orgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  const limit = filters.limit ?? 5;
  return useQuery({
    queryKey: briefsKeys.list(orgId, { ...filters, limit }),
    queryFn: () => BriefsAPI.list({ ...filters, limit }),
    enabled: !!orgId,
  });
}

export function useGetBrief(briefId: string | undefined) {
  const orgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useQuery({
    queryKey: briefsKeys.detail(orgId, briefId ?? ""),
    queryFn: () => BriefsAPI.get(briefId as string),
    enabled: !!orgId && !!briefId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (!status) return false;
      return POLL_STATUSES.includes(status) ? 2000 : false;
    },
  });
}

export function useGenerateBrief() {
  const queryClient = useQueryClient();
  const orgId = useActiveOrganizationStore((s) => s.activeOrganizationId);
  return useMutation({
    mutationFn: (data: GenerateBriefRequest) => BriefsAPI.generate(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["briefs", "list", orgId],
      });
    },
  });
}
