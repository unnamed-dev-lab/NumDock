import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { VirtualNumberCatalogItem } from "./types";

export function getCatalogColumns(
  t: TFunction,
  locale: string,
): ColumnDef<VirtualNumberCatalogItem>[] {
  const price = (amount: number, currency: string, digits: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits === 4 ? 6 : digits,
    }).format(amount);
  return [
    {
      accessorKey: "e164",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("workspace.numberAndRegion")}
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm font-semibold text-foreground">
            {row.original.e164}
          </span>
          <span className="text-xs text-muted-foreground">
            {row.original.country_code} · {row.original.region}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "number_type",
      enableSorting: false,
      header: () => t("workspace.lineType"),
      cell: ({ row }) =>
        t(
          row.original.number_type === "mobile"
            ? "workspace.typeMobile"
            : row.original.number_type === "toll_free"
              ? "workspace.typeTollFree"
              : "workspace.typeLocal",
        ),
    },
    {
      accessorKey: "provider",
      enableSorting: false,
      header: () => t("workspace.catalogProvider"),
    },
    {
      accessorKey: "capabilities",
      enableSorting: false,
      header: () => t("workspace.communicationCapabilities"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          {row.original.capabilities.map((capability) => (
            <Badge key={capability} variant="secondary">
              {t(
                capability === "sms"
                  ? "workspace.capabilitySms"
                  : capability === "voice"
                    ? "workspace.capabilityVoice"
                    : "workspace.capabilityMms",
              )}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "monthly_fee_minor",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("workspace.monthlyFee")}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {price(
            row.original.monthly_fee_minor / 100,
            row.original.currency,
            2,
          )}
        </span>
      ),
    },
    {
      accessorKey: "inbound_sms_fee_micros",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("workspace.inboundSmsRate")}
        />
      ),
      cell: ({ row }) =>
        row.original.capabilities.includes("sms") ? (
          <span className="font-mono text-sm">
            {price(
              row.original.inbound_sms_fee_micros / 1_000_000,
              row.original.currency,
              4,
            )}
          </span>
        ) : (
          t("workspace.notApplicable")
        ),
    },
    {
      id: "source",
      enableSorting: false,
      header: () => t("workspace.catalogSource"),
      cell: () => (
        <Badge variant="outline">{t("workspace.catalogMockOnly")}</Badge>
      ),
    },
  ];
}
