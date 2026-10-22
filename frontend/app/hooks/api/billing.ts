import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { retryRead } from "./policy";
export function usePayment(org: string, reference: string) {
  return useQuery({
    queryKey: queryKeys.payment(org, reference),
    enabled: !!org && !!reference,
    retry: retryRead,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET(
          "/v1/organizations/{organization_id}/billing/payments/{resource_id}",
          {
            params: { path: { organization_id: org, resource_id: reference } },
            signal,
          },
        ),
      ),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 5000 : false),
  });
}
