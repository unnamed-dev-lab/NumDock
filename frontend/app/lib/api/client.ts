import createClient from "openapi-fetch";
import { queryOptions } from "@tanstack/react-query";
import type { paths, components } from "./schema";

export const api = createClient<paths>({ credentials: "same-origin" });
export type Identity = components["schemas"]["Identity"];

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message); }
}

export function unwrap<T>(result: { data?: T; error?: components["schemas"]["Error"]; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    throw new ApiError(result.response.status, result.error?.code ?? "request_failed", result.error?.message ?? "We could not complete this request. Please try again.", result.error?.request_id);
  }
  return result.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Unable to connect. Check your connection and try again.";
}

export async function csrfHeaders() {
  const token = unwrap(await api.GET("/v1/auth/csrf"));
  return { "X-CSRF-Token": token.token };
}

export const identityQuery = queryOptions({
  queryKey: ["identity"],
  queryFn: async ({ signal }) => unwrap(await api.GET("/v1/me", { signal })),
  staleTime: 30_000,
  retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
});
