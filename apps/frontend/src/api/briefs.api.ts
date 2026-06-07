import type {
  ApiResponse,
  BriefResponse,
  GenerateBriefEnqueueResponse,
  GenerateBriefRequest,
  ListBriefsQuery,
  PaginatedBriefs,
} from "@launchstack/api-interfaces";
import { axiosInstance } from "./axios-client";

const BASE = "/api/organizations/current/briefs";

export const BriefsAPI = {
  list: async (
    params: Partial<ListBriefsQuery> = {},
  ): Promise<ApiResponse<PaginatedBriefs>> => {
    const response = await axiosInstance.request({
      url: BASE,
      method: "GET",
      params,
    });
    return response.data as ApiResponse<PaginatedBriefs>;
  },

  get: async (briefId: string): Promise<ApiResponse<BriefResponse>> => {
    const response = await axiosInstance.request({
      url: `${BASE}/${briefId}`,
      method: "GET",
    });
    return response.data as ApiResponse<BriefResponse>;
  },

  generate: async (
    data: GenerateBriefRequest,
  ): Promise<ApiResponse<GenerateBriefEnqueueResponse>> => {
    const response = await axiosInstance.request({
      url: `${BASE}/generate`,
      method: "POST",
      data,
    });
    return response.data as ApiResponse<GenerateBriefEnqueueResponse>;
  },
};
