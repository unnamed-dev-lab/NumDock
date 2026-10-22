export const queryKeys = {
  identity: ["identity"] as const,
  catalog: ["catalog"] as const,
  catalogNumbers: (query: object) => ["catalog", "numbers", query] as const,
  account: (org: string) => ["account", org] as const,
  summary: (org: string) => ["account", org, "summary"] as const,
  wallet: (org: string) => ["account", org, "wallet"] as const,
  resource: (org: string, resource: string) =>
    ["account", org, resource] as const,
  list: (org: string, resource: string, filters: object) =>
    ["account", org, resource, filters] as const,
  message: (org: string, id: string) =>
    ["account", org, "message", id] as const,
  payment: (org: string, reference: string) =>
    ["account", org, "payment", reference] as const,
  overview: (org: string, days: number) =>
    ["account", org, "overview", days] as const,
};
