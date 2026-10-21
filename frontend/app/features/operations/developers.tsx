import type { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ActionDialog,
  WorkspaceTable,
  State,
  useFormat,
  type FormField,
} from "./shared";
import { useOperations, type Snapshot } from "./runtime";
export function DeveloperTables() {
  const { t } = useTranslation();
  const { date } = useFormat();
  const { organization } = useOperations();
  if (organization?.role === "member")
    return (
      <p className="text-sm text-muted-foreground">
        {t("workspace.opsAdminOnly")}
      </p>
    );
  const fields: FormField[] = [
    { name: "name", label: "workspace.opsKeyName", maxLength: 80 },
    {
      name: "days",
      label: "workspace.opsExpiryDays",
      type: "number",
      min: 1,
      max: 90,
      default: "30",
    },
    ...(
      [
        "numbers:read",
        "numbers:write",
        "messages:read",
        "billing:read",
      ] as const
    ).map((scope) => ({
      name: scope,
      label: (
        {
          "numbers:read": "workspace.opsScopeNumbersRead",
          "numbers:write": "workspace.opsScopeNumbersWrite",
          "messages:read": "workspace.opsScopeMessagesRead",
          "billing:read": "workspace.opsScopeBillingRead",
        } as const
      )[scope],
      type: "switch" as const,
      default: scope !== "numbers:write",
    })),
  ];
  const keys: ColumnDef<Snapshot["api_keys"][number]>[] = [
    { accessorKey: "name", header: t("workspace.opsKeyName") },
    {
      accessorKey: "prefix",
      header: t("workspace.opsPrefix"),
      cell: ({ row }) => (
        <code className="text-xs">{row.original.prefix}…</code>
      ),
    },
    {
      accessorKey: "scopes",
      header: t("workspace.opsScopes"),
      cell: ({ row }) => (
        <span className="text-xs">{row.original.scopes.join(", ")}</span>
      ),
    },
    {
      accessorKey: "expires_at",
      header: t("workspace.opsExpires"),
      cell: ({ row }) => date(row.original.expires_at),
    },
    {
      id: "status",
      header: t("workspace.opsStatus"),
      cell: ({ row }) => (
        <State
          value={
            row.original.revoked
              ? "revoked"
              : new Date(row.original.expires_at).getTime() <= Date.now()
                ? "expired"
                : "active"
          }
        />
      ),
    },
    {
      id: "actions",
      header: t("workspace.opsActions"),
      cell: ({ row }) =>
        !row.original.revoked ? (
          <ActionDialog
            action="revoke_key"
            id={row.original.id}
            title={t("workspace.opsRevoke")}
          />
        ) : null,
    },
  ];
  const hooks: ColumnDef<Snapshot["webhooks"][number]>[] = [
    {
      accessorKey: "url",
      header: t("workspace.opsEndpoint"),
      cell: ({ row }) => (
        <span
          className="block max-w-72 truncate font-mono text-xs"
          title={row.original.url}
        >
          {row.original.url}
        </span>
      ),
    },
    {
      accessorKey: "enabled",
      header: t("workspace.opsStatus"),
      cell: ({ row }) => (
        <State value={row.original.enabled ? "active" : "disabled"} />
      ),
    },
    {
      accessorKey: "created_at",
      header: t("workspace.opsCreated"),
      cell: ({ row }) => date(row.original.created_at),
    },
    {
      id: "actions",
      header: t("workspace.opsActions"),
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.enabled ? (
            <ActionDialog
              action="test_webhook"
              id={row.original.id}
              title={t("workspace.opsTest")}
            />
          ) : null}
          <ActionDialog
            action="toggle_webhook"
            id={row.original.id}
            title={t(
              row.original.enabled
                ? "workspace.opsDisable"
                : "workspace.opsEnable",
            )}
            build={() => ({ enabled: !row.original.enabled })}
          />
        </div>
      ),
    },
  ];
  const deliveries: ColumnDef<Snapshot["deliveries"][number]>[] = [
    { accessorKey: "event_id", header: t("workspace.opsEvent") },
    {
      accessorKey: "endpoint_id",
      header: t("workspace.opsEndpoint"),
      cell: ({ row }) => (
        <span
          title={row.original.endpoint_id}
          className="block max-w-32 truncate font-mono text-xs"
        >
          {row.original.endpoint_id}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("workspace.opsStatus"),
      cell: ({ row }) => <State value={row.original.status} />,
    },
    { accessorKey: "attempts", header: t("workspace.opsAttempts") },
    { accessorKey: "response_status", header: t("workspace.opsHTTPStatus") },
    {
      accessorKey: "created_at",
      header: t("workspace.opsCreated"),
      cell: ({ row }) => date(row.original.created_at),
    },
  ];
  return (
    <Tabs defaultValue="keys" className="min-w-0 flex-col gap-4">
      <TabsList variant="line" aria-label={t("workspace.developerResources")}>
        <TabsTrigger value="keys">{t("workspace.apiKeys")}</TabsTrigger>
        <TabsTrigger value="webhooks">{t("workspace.webhooks")}</TabsTrigger>
        <TabsTrigger value="deliveries">
          {t("workspace.opsDeliveries")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="keys" className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          {t("workspace.opsKeysDescription")}
        </p>
        <WorkspaceTable
          view="keys"
          select={(s) => s.api_keys}
          columns={keys}
          toolbar={
            <ActionDialog
              action="create_key"
              title={t("workspace.opsCreateKey")}
              fields={fields}
              build={(v) => ({
                name: String(v.name),
                expires_days: Number(v.days),
                scopes: [
                  "numbers:read",
                  "numbers:write",
                  "messages:read",
                  "billing:read",
                ].filter((s) => !!v[s]),
              })}
            />
          }
        />
      </TabsContent>
      <TabsContent value="webhooks" className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          {t("workspace.opsWebhookDescription")}
        </p>
        <WorkspaceTable
          view="webhooks"
          select={(s) => s.webhooks}
          columns={hooks}
          toolbar={
            <ActionDialog
              action="create_webhook"
              title={t("workspace.opsCreateWebhook")}
              fields={[
                {
                  name: "url",
                  label: "workspace.opsEndpoint",
                  default: "mock://success",
                  maxLength: 2048,
                  pattern: /^(mock:\/\/(success|failure)$|https:\/\/)/,
                },
              ]}
              build={(v) => ({ url: String(v.url) })}
            />
          }
        />
      </TabsContent>
      <TabsContent value="deliveries" className="pt-4">
        <WorkspaceTable
          view="deliveries"
          select={(s) => s.deliveries}
          columns={deliveries}
        />
      </TabsContent>
    </Tabs>
  );
}
