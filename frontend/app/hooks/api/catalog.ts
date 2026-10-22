import { api, ApiError, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import type { paths } from "@/lib/api/schema";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./keys";
export type CatalogQuery = NonNullable<
  paths["/v1/catalog/numbers"]["get"]["parameters"]["query"]
>;
export type CatalogInitial = {
  query: CatalogQuery;
  data: components["schemas"]["CatalogList"];
  fetchedAt: number;
};
export function catalogQuery(
  query: CatalogQuery,
  initial?: CatalogInitial | null,
) {
  const matches =
    initial && JSON.stringify(initial.query) === JSON.stringify(query);
  return {
    queryKey: queryKeys.catalogNumbers(query),
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
      unwrap(
        await api.GET("/v1/catalog/numbers", { params: { query }, signal }),
      ),
    initialData: matches ? initial.data : undefined,
    initialDataUpdatedAt: matches ? initial.fetchedAt : undefined,
    staleTime: 30_000,
    retry: (count: number, error: Error) =>
      !(error instanceof ApiError && error.status < 500) && count < 1,
  };
}

export function useCatalogNumbers(
  query: CatalogQuery,
  initial?: CatalogInitial | null,
) {
  return useQuery({
    ...catalogQuery(query, initial),
    placeholderData: (previous) => previous,
  });
}
