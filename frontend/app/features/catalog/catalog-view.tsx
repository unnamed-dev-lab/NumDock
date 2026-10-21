import * as React from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { defaultCatalogItems } from "./catalog-data";
import { getCatalogColumns } from "./columns";
import { CatalogToolbar } from "./catalog-toolbar";
import { useCatalogStore } from "./catalog-store";
import type { VirtualNumberCatalogItem } from "./types";

interface CatalogViewProps {
  initialItems?: VirtualNumberCatalogItem[];
  balance?: number;
}

export function CatalogView({
  initialItems = defaultCatalogItems,
  balance = 146.0,
}: CatalogViewProps) {
  const { t } = useTranslation();
  const columns = React.useMemo(() => getCatalogColumns(t), [t]);

  const {
    globalFilter,
    setGlobalFilter,
    countryFilter,
    typeFilter,
    capabilityFilter,
    pageIndex,
    pageSize,
    setPagination,
  } = useCatalogStore();

  const columnFilters = React.useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (countryFilter && countryFilter !== "all") {
      filters.push({ id: "countryCode", value: countryFilter });
    }
    if (typeFilter && typeFilter !== "all") {
      filters.push({ id: "numberType", value: typeFilter });
    }
    if (capabilityFilter && capabilityFilter !== "all") {
      filters.push({ id: "capabilities", value: capabilityFilter });
    }
    return filters;
  }, [countryFilter, typeFilter, capabilityFilter]);

  return (
    <div className="space-y-6">
      {/* Catalog Header with balance */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("workspace.catalog")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workspace.catalogPoolDescription", {
              defaultValue: "可用号码库存池，即时购买并直连运营商中继。",
            })}
          </p>
        </div>

        {/* Top-right Balance display with top-up action */}
        <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-1.5 shadow-xs">
          <span className="text-xs text-muted-foreground">
            {t("workspace.balance", { defaultValue: "余额" })}:
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            ${balance.toFixed(2)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            render={<Link to="/app/billing" />}
          >
            <Plus className="mr-1 size-3" aria-hidden="true" />
            {t("workspace.topUp", { defaultValue: "充值" })}
          </Button>
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={initialItems}
        toolbar={() => <CatalogToolbar />}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        columnFilters={columnFilters}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={setPagination}
      />
    </div>
  );
}
