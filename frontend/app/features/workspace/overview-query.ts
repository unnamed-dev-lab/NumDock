import { queryOptions } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "@/lib/api/client";

export function overviewQuery(organizationId: string, days: 7 | 30) {
  return queryOptions({
    queryKey: ["overview", organizationId, days] as const,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/v1/organizations/{organization_id}/overview", {
          params: {
            path: { organization_id: organizationId },
            query: { days },
          },
          signal,
        }),
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status < 500) && count < 1,
  });
}
