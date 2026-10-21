import createClient from "openapi-fetch";
import { queryOptions } from "@tanstack/react-query";
import type { paths, components } from "./schema";
import type { TFunction } from "i18next";
import type { TranslationKey } from "@/lib/i18n";

export const api = createClient<paths>({ credentials: "same-origin" });
export type Identity = components["schemas"]["Identity"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
}

export function unwrap<T>(result: {
  data?: T;
  error?: components["schemas"]["Error"];
  response: Response;
}): T {
  if (!result.response.ok || result.data === undefined) {
    throw new ApiError(
      result.response.status,
      result.error?.code ?? "request_failed",
      result.error?.message ??
        "We could not complete this request. Please try again.",
      result.error?.request_id,
    );
  }
  return result.data;
}

const errorKeys: Record<string, TranslationKey> = {
  resource_limit: "errors.resource_limit",
  invalid_webhook_url: "errors.invalid_webhook_url",
  webhook_disabled: "errors.webhook_disabled",
  feature_disabled: "errors.feature_disabled",
  idempotency_conflict: "errors.idempotency_conflict",
  inventory_unavailable: "errors.inventory_unavailable",
  insufficient_balance: "errors.insufficient_balance",
  lease_inactive: "errors.lease_inactive",
  refund_unavailable: "errors.refund_unavailable",
  release_required: "errors.release_required",
  sms_unavailable: "errors.sms_unavailable",

  invalid_credentials: "errors.invalidCredentials",
  unauthenticated: "errors.unauthenticated",
  csrf_failed: "errors.csrfFailed",
  rate_limited: "errors.rateLimited",
  account_unavailable: "errors.accountUnavailable",
  validation_failed: "errors.validationFailed",
  invalid_request: "errors.invalidRequest",
  request_timeout: "errors.requestTimeout",
  not_ready: "errors.notReady",
  not_found: "errors.notFound",
  forbidden: "errors.forbidden",
  payload_too_large: "errors.payloadTooLarge",
  unsupported_media_type: "errors.unsupportedMediaType",
  method_not_allowed: "errors.methodNotAllowed",
  request_failed: "errors.requestFailed",
  internal_error: "errors.requestFailed",
};

export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError)
    return t(errorKeys[error.code] ?? "errors.requestFailed");
  return t("errors.network");
}

export async function csrfHeaders() {
  const token = unwrap(await api.GET("/v1/auth/csrf"));
  return { "X-CSRF-Token": token.token };
}

export const identityQuery = queryOptions({
  queryKey: ["identity"],
  queryFn: async ({ signal }) => {
    const result = await api.GET("/v1/me", { signal });
    // A confirmed anonymous session replaces any previous cached identity.
    if (result.response.status === 401) return null;
    return unwrap(result);
  },
  staleTime: 30_000,
  retry: (count, error) =>
    !(error instanceof ApiError && error.status < 500) && count < 1,
});
