import { useMemo } from "react";
import type { VirtualNumberCatalogItem } from "@/features/catalog/types";
import { catalogUseCaseLabels } from "@/features/catalog/use-cases";
import { Badge } from "@/components/ui/badge";
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
import type { ResourceItems } from "./runtime";
export function PurchaseNumber({
  id,
  e164,
  options,
}: {
  id: string;
  e164: string;
  options: VirtualNumberCatalogItem["rental_options"];
}) {
  const { t } = useTranslation();
  const { money } = useFormat();
  const [, setParams] = useSearchParams();
  const fields: FormField[] = [
    {
      name: "rental_days",
      label: "workspace.rentalPeriod",
      type: "select",
      hint: "workspace.chooseRentalPeriod",
      options: options.map((option) => ({
        value: String(option.days),
        label: t("workspace.rentalOption", {
          days: option.days,
          price: money(option.amount_minor),
        }),
      })),
    },
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
    {
      name: "terms",
      label: "workspace.opsTerms",
      type: "checkbox",
      required: true,
      hint: "workspace.confirmUseHint",
    },
  ];
  return (
    <ActionDialog
      action="purchase"
      title={t("workspace.opsPurchase")}
      description={t("workspace.opsPurchaseDescription", {
        number: e164,
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
        rental_days: Number(v.rental_days) as 3 | 7 | 30,
        simulate_failure: false,
      })}
    />
  );
}
export function NumbersTable() {
  const { t } = useTranslation();
  const { money, date } = useFormat();
  const columns = useMemo<ColumnDef<ResourceItems["numbers"][number]>[]>(
    () => [
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
        accessorKey: "use_cases",
        header: t("workspace.useCases"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {row.original.use_cases.map((useCase) => (
              <Badge key={useCase} variant="outline">
                {t(catalogUseCaseLabels[useCase] ?? "workspace.useCaseOther")}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("workspace.opsStatus"),
        cell: ({ row }) => <State value={row.original.status} />,
      },
      {
        accessorKey: "amount_minor",
        header: t("workspace.opsPrice"),
        cell: ({ row }) => money(row.original.amount_minor),
      },
      {
        accessorKey: "rental_days",
        header: t("workspace.rentalPeriod"),
        cell: ({ row }) =>
          t("workspace.rentalDays", { days: row.original.rental_days }),
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
                description={t("workspace.opsReleaseDescription", {
                  number: row.original.e164,
                })}
              />
            </div>
          ) : null,
      },
    ],
    [t, money, date],
  );
  return (
    <WorkspaceTable
      view="numbers"
      columns={columns}
      statuses={[
        { value: "active", label: t("workspace.active") },
        { value: "released", label: t("workspace.opsReleased") },
        { value: "expired", label: t("workspace.opsExpired") },
      ]}
    />
  );
}
