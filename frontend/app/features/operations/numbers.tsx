import { useSearchParams } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import {
  ActionDialog,
  WorkspaceTable,
  State,
  useFormat,
  type FormField,
} from "./shared";
import type { Snapshot } from "./runtime";
export function PurchaseNumber({
  id,
  e164,
  price,
}: {
  id: string;
  e164: string;
  price: number;
}) {
  const { t } = useTranslation();
  const { money } = useFormat();
  const [, setParams] = useSearchParams();
  const fields: FormField[] = [
    {
      name: "purpose",
      label: "workspace.opsPurpose",
      type: "select",
      default: "customer_support",
      options: [
        { value: "customer_support", label: t("workspace.opsSupport") },
        {
          value: "product_notifications",
          label: t("workspace.opsNotifications"),
        },
        { value: "service_testing", label: t("workspace.opsTesting") },
      ],
    },
    { name: "terms", label: "workspace.opsTerms", type: "switch" },
  ];
  return (
    <ActionDialog
      action="purchase"
      title={t("workspace.opsPurchase")}
      description={t("workspace.opsPurchaseDescription", {
        number: e164,
        price: money(price),
      })}
      fields={fields}
      onComplete={() =>
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.set("tab", "numbers");
            return next;
          },
          { preventScrollReset: true },
        )
      }
      build={(v) => ({
        catalog_item_id: id,
        purpose: String(v.purpose) as
          "customer_support" | "product_notifications" | "service_testing",
        confirmed_terms: !!v.terms,
        simulate_failure: false,
      })}
    />
  );
}
export function NumbersTable() {
  const { t } = useTranslation();
  const { money, date } = useFormat();
  const columns: ColumnDef<Snapshot["numbers"][number]>[] = [
    {
      accessorKey: "e164",
      header: t("workspace.opsNumber"),
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-medium">{row.original.e164}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.country_code} ·{" "}
            {row.original.capabilities.join(" / ")}
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
      accessorKey: "monthly_fee_minor",
      header: t("workspace.opsPrice"),
      cell: ({ row }) => money(row.original.monthly_fee_minor),
    },
    {
      accessorKey: "expires_at",
      header: t("workspace.opsExpires"),
      cell: ({ row }) => date(row.original.expires_at),
    },
    {
      id: "actions",
      header: t("workspace.opsActions"),
      cell: ({ row }) =>
        row.original.status === "active" ? (
          <div className="flex gap-2">
            {row.original.capabilities.includes("sms") ? (
              <ActionDialog
                action="simulate"
                title={t("workspace.opsSimulate")}
                build={() => ({ lease_id: row.original.id })}
              />
            ) : null}
            <ActionDialog
              action="release"
              id={row.original.id}
              title={t("workspace.opsRelease")}
              description={t("workspace.opsReleaseDescription")}
            />
          </div>
        ) : null,
    },
  ];
  return (
    <WorkspaceTable
      view="numbers"
      select={(s) => s.numbers}
      columns={columns}
      statuses={[
        { value: "active", label: t("workspace.active") },
        { value: "released", label: t("workspace.opsReleased") },
        { value: "expired", label: t("workspace.opsExpired") },
      ]}
    />
  );
}
