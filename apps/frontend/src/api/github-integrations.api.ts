import type {
  ApiResponse,
  GithubInstallationWithRepos,
  StartGithubConnectResponse,
} from "@launchstack/api-interfaces"
import { axiosInstance } from "./axios-client"

export const GithubIntegrationsAPI = {
  list: async (): Promise<ApiResponse<GithubInstallationWithRepos[]>> => {
    const response = await axiosInstance.request({
      url: "/api/integrations/github/installations",
      method: "GET",
    })
    return response.data as ApiResponse<GithubInstallationWithRepos[]>
  },

  start: async (): Promise<ApiResponse<StartGithubConnectResponse>> => {
    const response = await axiosInstance.request({
      url: "/api/integrations/github/installations/start",
      method: "POST",
    })
    return response.data as ApiResponse<StartGithubConnectResponse>
  },

  sync: async (
    installationId: string,
  ): Promise<ApiResponse<GithubInstallationWithRepos>> => {
    const response = await axiosInstance.request({
      url: `/api/integrations/github/installations/${installationId}/sync`,
      method: "POST",
    })
    return response.data as ApiResponse<GithubInstallationWithRepos>
  },

  disconnect: async (installationId: string): Promise<void> => {
    await axiosInstance.request({
      url: `/api/integrations/github/installations/${installationId}`,
      method: "DELETE",
    })
  },
}
