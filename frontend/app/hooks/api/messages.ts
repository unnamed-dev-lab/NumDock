import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { retryRead } from "./policy";
export function useMessage(org: string, id: string, open: boolean) {
  const client = useQueryClient();
  const result = useQuery({
    queryKey: queryKeys.message(org, id),
    enabled: !!org && open,
    retry: retryRead,
    gcTime: 0,
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET(
          "/v1/organizations/{organization_id}/messages/{resource_id}",
          {
            params: { path: { organization_id: org, resource_id: id } },
            signal,
          },
        ),
      ),
  });
  // Reading a message marks it read on the server. Keep that side effect out
  // of the query function so retries cannot repeat cache invalidation.
  useEffect(() => {
    if (!result.data || !result.dataUpdatedAt) return;
    void client.invalidateQueries({
      queryKey: queryKeys.resource(org, "messages"),
    });
    void client.invalidateQueries({ queryKey: queryKeys.summary(org) });
  }, [client, org, result.data, result.dataUpdatedAt]);
  useEffect(() => {
    if (!open) client.removeQueries({ queryKey: queryKeys.message(org, id) });
  }, [client, org, id, open]);
  return result;
}
