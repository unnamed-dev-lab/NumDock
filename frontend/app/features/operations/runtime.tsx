import { createContext, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { Identity } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useAccountSummary } from "@/hooks/api/resources";
import { useAccountEvents } from "@/hooks/api/events";
export type { Resource as View, ResourceItems } from "@/hooks/api/resources";
export type { Action, Command, Result } from "@/hooks/api/commands";
type ContextValue = {
  organization?: Identity["organizations"][number];
  summary?: components["schemas"]["AccountSummary"];
  summaryError?: unknown;
};
const Context = createContext<ContextValue>({});
export function OperationsProvider({
  identity,
  children,
}: {
  identity: Identity;
  children: ReactNode;
}) {
  const [params] = useSearchParams();
  const organization =
    identity.organizations.find(
      (o) =>
        o.slug === params.get("organization") ||
        o.id === params.get("organization"),
    ) ?? identity.organizations[0];
  const summary = useAccountSummary(organization?.id ?? "");
  useAccountEvents(organization?.id ?? "", summary.data?.mode === "mock");
  return (
    <Context.Provider
      value={{
        organization,
        summary: summary.data,
        summaryError: summary.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useOperations = () => useContext(Context);
