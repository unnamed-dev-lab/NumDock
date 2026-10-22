import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { ApiError, unwrap, type Identity } from "./client";

function baseURL() {
  return (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080").replace(
    /\/$/,
    "",
  );
}

export function serverApi() {
  return createClient<paths>({ baseUrl: baseURL() });
}

// Server loaders run before the browser query cache exists. Keep this path
// typed by the generated contract and translate transport failures into the
// same ApiError shape used by the client hooks.
export async function fetchServerIdentity(
  request: Request,
): Promise<Identity | null> {
  let result;
  try {
    result = await serverApi().GET("/v1/me", {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApiError(
      502,
      "account_unavailable",
      "Unable to reach the identity service.",
    );
  }

  if (result.response.status === 401) return null;
  return unwrap(result);
}
