import { queryOptions, useQuery } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import type { TranslationKey } from "@/lib/i18n";

export type PublicStatus = components["schemas"]["PublicStatus"];
export const publicStatusQuery = queryOptions({
  queryKey: ["public-status"],
  queryFn: async ({ signal }) =>
    unwrap(await api.GET("/v1/status", { signal })),
  staleTime: 30_000,
  retry: (count, error) =>
    !(error instanceof ApiError && error.status < 500) && count < 1,
});

export function usePublicStatus(initialStatus: PublicStatus | null) {
  return useQuery({
    ...publicStatusQuery,
    initialData: initialStatus ?? undefined,
    initialDataUpdatedAt: initialStatus
      ? Date.parse(initialStatus.checked_at)
      : undefined,
  });
}

export function featurePresentation(
  status: PublicStatus | undefined,
  feature: keyof PublicStatus["features"],
) {
  const mode = status?.features[feature] ?? "unavailable";
  const label: TranslationKey =
    mode === "mock"
      ? "status.mockEnabled"
      : mode === "active"
        ? "status.online"
        : mode === "disabled"
          ? "status.disabled"
          : "status.offline";
  const tone =
    mode === "mock"
      ? ("warning" as const)
      : mode === "active"
        ? ("active" as const)
        : ("neutral" as const);
  return { label, tone, online: mode === "active" || mode === "mock" };
}
