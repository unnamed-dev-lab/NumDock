import createClient from "openapi-fetch";
import type { paths, components } from "./schema";
import type { TFunction } from "i18next";
import type { TranslationKey } from "@/lib/i18n";

function nonContractResponse(response: Response) {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    console.error("[numdock] API returned a non-contract response", {
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type"),
    });
  }
  return new Response(
    JSON.stringify({
      code: "not_ready",
      message: "The API did not return a contract response.",
    }),
    {
      status: 502,
      headers: {
        "content-type": "application/json",
        ...(response.headers.has("x-request-id")
          ? { "x-request-id": response.headers.get("x-request-id")! }
          : {}),
      },
    },
  );
}

// Non-JSON responses are usually a dev proxy or reverse proxy serving a
// different application. Convert them into the contract error shape so every
// caller gets one retryable ApiError instead of a parse failure.
const jsonOnlyFetch: typeof globalThis.fetch = async (input, init) => {
  const response = await globalThis.fetch(input, init);
  if (response.status === 204) return response;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? response
    : nonContractResponse(response);
};

export const api = createClient<paths>({
  credentials: "same-origin",
  fetch: jsonOnlyFetch,
});
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

function logNonContractResponse(response: Response) {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    console.error("[numdock] API returned a non-contract response", {
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type"),
    });
  }
}

export function unwrap<T>(result: {
  data?: T;
  error?: components["schemas"]["Error"];
  response: Response;
}): T {
  if (!result.response.ok) {
    // A non-JSON error usually means the proxy or API origin is serving a
    // different application. Keep it retryable instead of surfacing a raw
    // validation/request failure.
    if (!result.error) {
      logNonContractResponse(result.response);
      throw new ApiError(
        result.response.status,
        "not_ready",
        "The API did not return a contract error. Please try again.",
        result.response.headers.get("x-request-id") ?? undefined,
      );
    }
    throw new ApiError(
      result.response.status,
      result.error.code,
      result.error.message,
      result.error.request_id,
    );
  }

  if (result.data === undefined) {
    // A successful status without a JSON body usually means a proxy or the
    // API origin is serving something other than the NumDock contract.
    logNonContractResponse(result.response);
    throw new ApiError(
      502,
      "not_ready",
      "The API did not return data. Please try again.",
      result.response.headers.get("x-request-id") ?? undefined,
    );
  }

  return result.data;
}

const errorKeys: Record<string, TranslationKey> = {
  resource_limit: "errors.resource_limit",
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
  terms_required: "errors.termsRequired",
  invalid_rental_period: "errors.invalidRentalPeriod",
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
