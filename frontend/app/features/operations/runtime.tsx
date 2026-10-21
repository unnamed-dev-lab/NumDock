import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  unwrap,
  csrfHeaders,
  type Identity,
} from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
export type Snapshot = components["schemas"]["WorkspaceSnapshot"];
export type Command = components["schemas"]["WorkspaceCommand"];
export type Result = components["schemas"]["WorkspaceResult"];
export type View =
  | "numbers"
  | "messages"
  | "orders"
  | "ledger"
  | "keys"
  | "webhooks"
  | "deliveries";
export type Action =
  | "credit"
  | "purchase"
  | "release"
  | "refund"
  | "simulate"
  | "delete_message"
  | "create_key"
  | "revoke_key"
  | "create_webhook"
  | "toggle_webhook"
  | "test_webhook";
const Context = createContext<{
  organization?: Identity["organizations"][number];
  summary?: Snapshot;
  summaryError?: unknown;
  summaryPending?: boolean;
}>({});
export function OperationsProvider({
  identity,
  children,
}: {
  identity: Identity;
  children: ReactNode;
}) {
  const [params] = useSearchParams();
  const client = useQueryClient();
  const organization =
    identity.organizations.find((o) => o.id === params.get("organization")) ??
    identity.organizations[0];
  const summary = useQuery({
    queryKey: ["operations", organization?.id, "summary"],
    queryFn: ({ signal }) =>
      readWorkspace(organization!.id, "numbers", 1, 0, "", "", signal),
    enabled: !!organization,
    staleTime: 15000,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status < 500) && count < 1,
  });
  useEffect(() => {
    if (!organization || summary.data?.mode !== "mock") return;
    const stream = new EventSource(
      `/v1/organizations/${organization.id}/events/stream`,
    );
    stream.onmessage = () => {
      void client.invalidateQueries({
        queryKey: ["operations", organization.id],
      });
      void client.invalidateQueries({ queryKey: ["catalog"] });
      void client.invalidateQueries({
        queryKey: ["overview", organization.id],
      });
    };
    return () => stream.close();
  }, [organization, summary.data?.mode, client]);
  return (
    <Context.Provider
      value={{
        organization,
        summary: summary.data,
        summaryError: summary.error,
        summaryPending: summary.isPending,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useOperations = () => useContext(Context);
export function readWorkspace(
  org: string,
  view: View,
  limit = 20,
  offset = 0,
  status = "",
  q = "",
  signal?: AbortSignal,
) {
  return api
    .GET("/v1/organizations/{organization_id}/workspace", {
      params: {
        path: { organization_id: org },
        query: { view, limit, offset, status, q },
      },
      signal,
    })
    .then(unwrap);
}
export async function execute(
  org: string,
  action: Action,
  body: Command,
  key: string,
  id = "",
): Promise<Result> {
  const headers = { ...(await csrfHeaders()), "Idempotency-Key": key };
  const params = {
    header: headers,
    path: { organization_id: org, resource_id: id },
  };
  if (action === "delete_message")
    return unwrap(
      await api.DELETE(
        "/v1/organizations/{organization_id}/messages/{resource_id}",
        { params, headers, body },
      ),
    );
  if (action === "toggle_webhook")
    return unwrap(
      await api.PATCH(
        "/v1/organizations/{organization_id}/webhooks/{resource_id}",
        { params, headers, body },
      ),
    );
  const paths = {
    credit: "/v1/organizations/{organization_id}/billing/mock-credit",
    purchase: "/v1/organizations/{organization_id}/orders",
    release: "/v1/organizations/{organization_id}/leases/{resource_id}/release",
    refund: "/v1/organizations/{organization_id}/orders/{resource_id}/refund",
    simulate: "/v1/organizations/{organization_id}/messages/simulate",
    create_key: "/v1/organizations/{organization_id}/api-keys",
    revoke_key:
      "/v1/organizations/{organization_id}/api-keys/{resource_id}/revoke",
    create_webhook: "/v1/organizations/{organization_id}/webhooks",
    test_webhook:
      "/v1/organizations/{organization_id}/webhooks/{resource_id}/test",
  } as const;
  return unwrap(await api.POST(paths[action], { params, headers, body }));
}
