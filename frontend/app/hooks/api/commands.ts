import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, csrfHeaders, unwrap } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { queryKeys } from "./keys";
import { invalidateAccount } from "./cache";
export type Command = components["schemas"]["WorkspaceCommand"];
export type Result = components["schemas"]["WorkspaceResult"];
export type Action =
  | "create_payment"
  | "pay_payment"
  | "cancel_payment"
  | "purchase"
  | "release"
  | "refund"
  | "simulate"
  | "delete_message";
export type CommandInput = {
  org: string;
  action: Action;
  body: Command;
  key: string;
  id?: string;
};
async function execute({
  org,
  action,
  body,
  key,
  id = "",
}: CommandInput): Promise<Result> {
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
  const paths = {
    create_payment: "/v1/organizations/{organization_id}/billing/payments",
    pay_payment:
      "/v1/organizations/{organization_id}/billing/payments/{resource_id}/confirm",
    cancel_payment:
      "/v1/organizations/{organization_id}/billing/payments/{resource_id}/cancel",
    purchase: "/v1/organizations/{organization_id}/orders",
    release: "/v1/organizations/{organization_id}/leases/{resource_id}/release",
    refund: "/v1/organizations/{organization_id}/orders/{resource_id}/refund",
    simulate: "/v1/organizations/{organization_id}/messages/simulate",
  } as const;
  return unwrap(await api.POST(paths[action], { params, headers, body }));
}
export function useCommandMutation(callbacks?: {
  onSuccess?: (result: Result) => void;
  onSettled?: () => void;
}) {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: execute,
    onSuccess: (result, input) => {
      const resources: Record<Action, readonly string[]> = {
        create_payment: ["payments"],
        pay_payment: ["payments", "payment", "wallet", "ledger"],
        cancel_payment: ["payments", "payment"],
        purchase: ["numbers", "orders", "wallet", "ledger", "overview"],
        release: ["numbers", "orders", "overview"],
        refund: ["orders", "wallet", "ledger", "overview"],
        simulate: ["messages", "overview"],
        delete_message: ["messages", "message", "overview"],
      };
      if (result.payment)
        client.setQueryData(
          queryKeys.payment(input.org, result.payment.reference),
          result.payment,
        );
      invalidateAccount(client, input.org, resources[input.action]);
      if (input.action === "purchase" || input.action === "release")
        void client.invalidateQueries({ queryKey: queryKeys.catalog });
      if (input.action === "delete_message")
        client.removeQueries({
          queryKey: queryKeys.message(input.org, input.id ?? ""),
        });
      callbacks?.onSuccess?.(result);
    },
    onSettled: () => callbacks?.onSettled?.(),
  });
}
