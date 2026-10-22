import { serverApi } from "@/lib/api/server";
import { parseCatalogParams } from "@/features/catalog/use-catalog-params";
import type { CatalogInitial } from "@/hooks/api/catalog";

export async function fetchPublicCatalog(
  request: Request,
): Promise<CatalogInitial | null> {
  const query = parseCatalogParams(new URL(request.url).searchParams);
  const client = serverApi();
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
