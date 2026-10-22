import { useLocation, useNavigate } from "react-router";
import { PaymentHistory } from "./payments";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionDialog, WorkspaceTable, State, useFormat } from "./shared";
import { useOperations, type ResourceItems } from "./runtime";
export function WalletSummary() {
  const { t } = useTranslation();
  const { summary, organization } = useOperations();
  const navigate = useNavigate();
  const location = useLocation();
  const { money } = useFormat();
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 border-b border-border py-4">
      <dl className="flex flex-wrap gap-8">
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("workspace.opsAvailable")}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {summary ? money(summary.wallet.available_minor) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("workspace.opsReserved")}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {summary ? money(summary.wallet.reserved_minor) : "—"}
          </dd>
        </div>
      </dl>
      <ActionDialog
        action="create_payment"
        onComplete={(result) => {
          if (!result.payment) return;
          const params = new URLSearchParams();
          params.set("payment", result.payment.reference);
          if (
            organization &&
            new URLSearchParams(location.search).has("organization")
          )
            params.set("organization", organization.slug);
          if (location.pathname === "/app/numbers")
            params.set("returnTo", location.pathname + location.search);
          void navigate("/app/billing?" + params);
        }}
        title={t("workspace.opsTopUp")}
        description={t("workspace.opsCreditDescription")}
        fields={[
          {
            name: "amount",
            label: "workspace.opsAmount",
            type: "money",
            default: "100",
            min: 1,
            max: 10000,
          },
        ]}
        build={(v) => {
          const [whole, fraction = ""] = String(v.amount).split(".");
          return {
            amount_minor: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
          };
        }}
      />
    </div>
  );
}
export function BillingTables() {
  const { t } = useTranslation();
  const { money, date } = useFormat();
  const orders = useMemo<ColumnDef<ResourceItems["orders"][number]>[]>(
    () => [
      {
        accessorKey: "e164",
        header: t("workspace.opsNumber"),
        cell: ({ row }) => (
          <div>
            <p className="font-mono">{row.original.e164}</p>
            <p
              className="max-w-40 truncate text-xs text-muted-foreground"
              title={row.original.id}
            >
              {row.original.id}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("workspace.opsStatus"),
        cell: ({ row }) => <State value={row.original.status} />,
      },
      {
        accessorKey: "rental_days",
        header: t("workspace.rentalPeriod"),
        cell: ({ row }) =>
          t("workspace.rentalDays", { days: row.original.rental_days }),
      },
      {
        accessorKey: "amount_minor",
        header: t("workspace.opsAmount"),
        cell: ({ row }) => money(row.original.amount_minor),
      },
      {
        accessorKey: "created_at",
        header: t("workspace.opsCreated"),
        cell: ({ row }) => date(row.original.created_at),
      },
      {
        id: "actions",
        header: t("workspace.opsActions"),
        cell: ({ row }) =>
          row.original.status === "completed" ? (
            <ActionDialog
              action="refund"
              id={row.original.id}
              title={t("workspace.opsRefund")}
              description={t("workspace.opsRefundDescription", {
                number: row.original.e164,
              })}
            />
          ) : null,
      },
    ],
    [t, money, date],
  );
  const ledger = useMemo<ColumnDef<ResourceItems["ledger"][number]>[]>(
    () => [
      {
        accessorKey: "kind",
        header: t("workspace.opsType"),
        cell: ({ row }) => <State value={row.original.kind} />,
      },
      {
        accessorKey: "available_delta",
        header: t("workspace.opsAvailableChange"),
        cell: ({ row }) => money(row.original.available_delta),
      },
      {
        accessorKey: "reserved_delta",
        header: t("workspace.opsReservedChange"),
        cell: ({ row }) => money(row.original.reserved_delta),
      },
      {
        accessorKey: "available_after",
        header: t("workspace.opsBalanceAfter"),
        cell: ({ row }) => money(row.original.available_after),
      },
      {
        accessorKey: "reference_id",
        header: t("workspace.opsReference"),
        cell: ({ row }) => (
          <span
            className="block max-w-40 truncate font-mono text-xs"
            title={row.original.reference_id}
          >
            {row.original.reference_id}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: t("workspace.opsCreated"),
        cell: ({ row }) => date(row.original.created_at),
      },
    ],
    [t, money, date],
  );
  return (
    <Tabs defaultValue="payments" className="min-w-0 flex-col gap-4">
      <TabsList variant="line" aria-label={t("workspace.billing")}>
        <TabsTrigger value="payments">
          {t("workspace.paymentHistory")}
        </TabsTrigger>
        <TabsTrigger value="orders">{t("workspace.opsOrders")}</TabsTrigger>
        <TabsTrigger value="ledger">
          {t("workspace.immutableLedger")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="payments" className="pt-4">
        <PaymentHistory />
      </TabsContent>
      <TabsContent value="orders" className="pt-4">
        <WorkspaceTable
          view="orders"
          columns={orders}
          statuses={[
            { value: "completed", label: t("workspace.opsCompleted") },
            { value: "failed", label: t("workspace.opsFailed") },
            { value: "refunded", label: t("workspace.opsRefunded") },
          ]}
        />
      </TabsContent>
      <TabsContent value="ledger" className="pt-4">
        <WorkspaceTable view="ledger" columns={ledger} />
      </TabsContent>
    </Tabs>
  );
}
