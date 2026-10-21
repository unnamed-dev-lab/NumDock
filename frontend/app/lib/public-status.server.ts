export type PublicStatus = {
  api: boolean;
  database: boolean;
  checkedAt: string;
};

const DEFAULT_API = "http://127.0.0.1:8080";

export async function fetchPublicStatus(): Promise<PublicStatus> {
  const base = process.env.API_INTERNAL_URL ?? DEFAULT_API;
  const checkedAt = new Date().toISOString();

  const check = async (path: string) => {
    try {
      const response = await fetch(`${base}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const [api, database] = await Promise.all([
    check("/healthz"),
    check("/readyz"),
  ]);

  return { api, database, checkedAt };
}
