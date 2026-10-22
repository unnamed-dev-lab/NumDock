import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export function invalidateAccount(
  client: QueryClient,
  org: string,
  resources: readonly string[],
) {
  void client.invalidateQueries({ queryKey: queryKeys.summary(org) });
  for (const resource of new Set(resources))
    void client.invalidateQueries({
      queryKey: queryKeys.resource(org, resource),
    });
}
export function useRefreshAccount(org: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.account(org) });
}
const eventResources: Record<string, readonly string[]> = {
  "message.received": ["messages", "overview"],
  "message.read": ["messages", "overview"],
  "message.deleted": ["messages", "overview"],
  "number.updated": ["numbers", "orders", "overview"],
  "order.updated": ["numbers", "orders", "ledger", "overview"],
  "wallet.updated": ["ledger", "payments"],
  "payment.updated": ["payments", "payment"],
};
export function invalidateEvents(
  client: QueryClient,
  org: string,
  types: ReadonlySet<string>,
) {
  if ([...types].some((type) => !eventResources[type])) {
    void client.invalidateQueries({ queryKey: queryKeys.account(org) });
    void client.invalidateQueries({ queryKey: queryKeys.catalog });
    return;
  }
  invalidateAccount(client, org, [
    ...new Set([...types].flatMap((type) => eventResources[type] ?? [])),
  ]);
  if (types.has("number.updated") || types.has("order.updated"))
    void client.invalidateQueries({ queryKey: queryKeys.catalog });
}
