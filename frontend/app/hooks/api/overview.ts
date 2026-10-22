import { useEffect } from "react";
import { queryKeys } from "./keys";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "@/lib/api/client";

export function overviewQuery(organizationId: string, days: 7 | 30) {
  return queryOptions({
    queryKey: queryKeys.overview(organizationId, days),
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

export function useOverview(org: string, days: 7 | 30) {
  const client = useQueryClient();
  const result = useQuery({
    ...overviewQuery(org, days),
    enabled: !!org,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === org ? previous : undefined,
  });
  useEffect(() => {
    if (!org || result.data?.mode !== "mock" || result.isPlaceholderData)
      return;
    void client.prefetchQuery(overviewQuery(org, days === 7 ? 30 : 7));
  }, [client, org, days, result.data, result.isPlaceholderData]);
  return result;
}
