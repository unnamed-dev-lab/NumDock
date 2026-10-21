import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import type { PublicStatus } from "@/features/marketing/public-status-query";

export async function fetchPublicStatus(): Promise<PublicStatus | null> {
  const client = createClient<paths>({
    baseUrl: process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080",
  });
  try {
    const result = await client.GET("/v1/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    return result.response.ok && result.data ? result.data : null;
  } catch {
    return null;
  }
}
