import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { VirtualNumberCatalogItem } from "./types";

function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const capabilityLabels: Record<string, string> = {
  auth_whatsapp: "WhatsApp",
  auth_google: "Google",
  auth_telegram: "Telegram",
  auth_bank_2fa: "银行 2FA",
  auth_openai: "OpenAI",
};

export function getCatalogColumns(t: (key: string, options?: unknown) => string): ColumnDef<VirtualNumberCatalogItem>[] {
  return [
    {
      accessorKey: "countryCode",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      filterFn: (row, id, value) => {
        if (!value || value === "all") return true;
        return row.getValue(id) === value;
      },
    },
    {
      accessorKey: "phoneNumber",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("workspace.numberAndRegion", { defaultValue: "号码与地区" })}
        />
      ),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none select-none" aria-hidden="true">
              {getCountryFlag(item.countryCode)}
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                {item.phoneNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.region}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "numberType",
      header: () => (
        <span className="text-xs font-medium text-muted-foreground">
          {t("workspace.lineType", { defaultValue: "线路类型" })}
        </span>
      ),
      cell: ({ row }) => {
        const type = row.original.numberType;
        const label =
          type === "mobile"
            ? t("workspace.typeMobile", { defaultValue: "移动号码" })
            : t("workspace.typeLocal", { defaultValue: "本地号码" });
        return <span className="text-sm text-foreground">{label}</span>;
      },
      filterFn: (row, id, value) => {
        if (!value || value === "all") return true;
        return row.getValue(id) === value;
      },
    },
    {
      accessorKey: "carrierProvider",
      header: () => (
        <span className="text-xs font-medium text-muted-foreground">
          {t("workspace.carrierRelay", { defaultValue: "运营商中继" })}
        </span>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.carrierProvider}
        </span>
      ),
    },
    {
      accessorKey: "capabilities",
      header: () => (
        <span className="text-xs font-medium text-muted-foreground">
          {t("workspace.verified2FACapabilities", { defaultValue: "已验证 2FA 能力" })}
        </span>
      ),
      cell: ({ row }) => {
        const caps = row.original.capabilities;
        return (
          <div className="flex flex-wrap gap-1.5">
            {caps.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className="rounded-md px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground"
              >
                {capabilityLabels[cap] ?? cap}
              </Badge>
            ))}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        if (!value || value === "all") return true;
        const caps = row.getValue<string[]>(id);
        return Array.isArray(caps) && caps.includes(value);
      },
    },
    {
      accessorKey: "monthlyFee",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("workspace.monthlyFee", { defaultValue: "月费" })}
        />
      ),
      cell: ({ row }) => {
        const fee = Number(row.original.monthlyFee);
        return (
          <span className="font-mono text-sm font-semibold text-foreground">
            ${fee.toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: "perSmsFee",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t("workspace.inboundSmsRate", { defaultValue: "入站短信" })}
        />
      ),
      cell: ({ row }) => {
        const rate = Number(row.original.perSmsFee);
        return (
          <span className="font-mono text-sm text-muted-foreground">
            ${rate.toFixed(4)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <span className="text-xs font-medium text-muted-foreground">
          {t("workspace.actions", { defaultValue: "操作" })}
        </span>
      ),
      cell: ({ row }) => {
        const item = row.original;
        if (item.status === "allocated") {
          return (
            <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground select-none">
              {t("workspace.allocated", { defaultValue: "已分配" })}
            </span>
          );
        }
        return (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={() => {
              // Action handled by order drawer or lease dialog
            }}
          >
            {t("workspace.buyLine", { defaultValue: "购买线路" })}
          </Button>
        );
      },
    },
  ];
}
