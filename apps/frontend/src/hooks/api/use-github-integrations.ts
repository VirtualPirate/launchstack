import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { GithubIntegrationsAPI } from "@/api/github-integrations.api"
import { useActiveOrganizationStore } from "@/stores/active-organization-store"

export const githubKeys = {
  installations: (orgId: string | null) =>
    ["github", "installations", orgId] as const,
}

export function useGithubInstallations() {
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId)
  return useQuery({
    queryKey: githubKeys.installations(activeOrgId),
    queryFn: () => GithubIntegrationsAPI.list(),
    enabled: !!activeOrgId,
  })
}

export function useStartGithubConnect() {
  return useMutation({
    mutationFn: () => GithubIntegrationsAPI.start(),
    onSuccess: (res) => {
      window.location.href = res.data.installUrl
    },
  })
}

export function useSyncGithubInstallation() {
  const queryClient = useQueryClient()
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId)
  return useMutation({
    mutationFn: (installationId: string) =>
      GithubIntegrationsAPI.sync(installationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: githubKeys.installations(activeOrgId),
      })
    },
  })
}

export function useDisconnectGithubInstallation() {
  const queryClient = useQueryClient()
  const activeOrgId = useActiveOrganizationStore((s) => s.activeOrganizationId)
  return useMutation({
    mutationFn: (installationId: string) =>
      GithubIntegrationsAPI.disconnect(installationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: githubKeys.installations(activeOrgId),
      })
    },
  })
}
