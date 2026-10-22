import { queryOptions, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "./keys";
import { retryRead } from "./policy";

export type ResourceLists = {
  numbers: components["schemas"]["NumberList"];
  messages: components["schemas"]["MessageList"];
  orders: components["schemas"]["OrderList"];
  ledger: components["schemas"]["LedgerList"];
  payments: components["schemas"]["PaymentList"];
};
export type Resource = keyof ResourceLists;
export type ResourceItems = { [K in Resource]: ResourceLists[K]["items"] };
export type ListFilters = {
  limit: number;
  offset: number;
  status: string;
  q: string;
};
type ReadInput = { org: string; filters: ListFilters; signal: AbortSignal };
const fetchers = {
  numbers: async ({ org, filters, signal }: ReadInput) =>
    unwrap(
      await api.GET("/v1/organizations/{organization_id}/numbers", {
        params: { path: { organization_id: org }, query: filters },
        signal,
      }),
    ),
  messages: async ({ org, filters, signal }: ReadInput) =>
    unwrap(
      await api.GET("/v1/organizations/{organization_id}/messages", {
        params: { path: { organization_id: org }, query: filters },
        signal,
      }),
    ),
  orders: async ({ org, filters, signal }: ReadInput) =>
    unwrap(
      await api.GET("/v1/organizations/{organization_id}/orders", {
        params: { path: { organization_id: org }, query: filters },
        signal,
      }),
    ),
  ledger: async ({ org, filters, signal }: ReadInput) =>
    unwrap(
      await api.GET("/v1/organizations/{organization_id}/billing/ledger", {
        params: { path: { organization_id: org }, query: filters },
        signal,
      }),
    ),
  payments: async ({ org, filters, signal }: ReadInput) =>
    unwrap(
      await api.GET("/v1/organizations/{organization_id}/billing/payments", {
        params: { path: { organization_id: org }, query: filters },
        signal,
      }),
    ),
};
export function resourceQuery<R extends Resource>(
  org: string,
  resource: R,
  filters: ListFilters,
) {
  return queryOptions({
    queryKey: queryKeys.list(org, resource, filters),
    queryFn: async ({ signal }): Promise<ResourceLists[R]> => {
      const result = await fetchers[resource]({ org, filters, signal });
      // Each resource key maps to its own generated endpoint and generated response.
      return result as ResourceLists[R];
    },
    enabled: !!org,
    retry: retryRead,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === org &&
      previousQuery.queryKey[2] === resource
        ? previous
        : undefined,
  });
}
export function useResourceList<R extends Resource>(
  org: string,
  resource: R,
  filters: ListFilters,
) {
  return useQuery(resourceQuery(org, resource, filters));
}
export function useAccountSummary(org: string) {
  return useQuery({
    queryKey: queryKeys.summary(org),
    enabled: !!org,
    staleTime: 15000,
    retry: retryRead,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/v1/organizations/{organization_id}/summary", {
          params: { path: { organization_id: org } },
          signal,
        }),
      ),
  });
}
export function useWallet(org: string) {
  return useQuery({
    queryKey: queryKeys.wallet(org),
    enabled: !!org,
    retry: retryRead,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/v1/organizations/{organization_id}/billing/wallet", {
          params: { path: { organization_id: org } },
          signal,
        }),
      ),
  });
}
