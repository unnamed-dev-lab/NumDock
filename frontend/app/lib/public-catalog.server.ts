import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import { parseCatalogParams } from "@/features/catalog/use-catalog-params";
import type { CatalogInitial } from "@/hooks/api/catalog";

export async function fetchPublicCatalog(
  request: Request,
): Promise<CatalogInitial | null> {
  const query = parseCatalogParams(new URL(request.url).searchParams);
  const client = createClient<paths>({
    baseUrl: process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080",
  });
  try {
    const result = await client.GET("/v1/catalog/numbers", {
      params: { query },
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    return result.response.ok && result.data
      ? { query, data: result.data, fetchedAt: Date.now() }
      : null;
  } catch {
    return null;
  }
}
