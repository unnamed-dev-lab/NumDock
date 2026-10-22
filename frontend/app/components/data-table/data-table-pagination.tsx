import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/motion/button/base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pending?: boolean;
}

export function DataTablePagination<TData>({
  table,
  pending = false,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        className="text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {pending
          ? t("workspace.opsLoading")
          : t("workspace.tableTotalRows", {
              total:
                table.options.rowCount ??
                table.getFilteredRowModel().rows.length,
            })}
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center space-x-2">
          <p className="text-xs text-muted-foreground">
            {t("workspace.rowsPerPage")}
          </p>
          <Select
            disabled={pending}
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              if (value) {
                table.setPageSize(Number(value));
              }
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-11 w-20 sm:h-8"
              aria-label={t("workspace.rowsPerPage")}
            >
              <SelectValue
                placeholder={`${table.getState().pagination.pageSize}`}
              />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          {t("workspace.pageOf", {
            current: table.getState().pagination.pageIndex + 1,
            total: Math.max(table.getPageCount(), 1),
          })}
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="icon"
            className="size-11 p-0 sm:size-8"
            onClick={() => table.setPageIndex(0)}
            disabled={pending || !table.getCanPreviousPage()}
            aria-label={t("workspace.goToFirstPage")}
          >
            <ChevronsLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 p-0 sm:size-8"
            onClick={() => table.previousPage()}
            disabled={pending || !table.getCanPreviousPage()}
            aria-label={t("workspace.goToPreviousPage")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 p-0 sm:size-8"
            onClick={() => table.nextPage()}
            disabled={pending || !table.getCanNextPage()}
            aria-label={t("workspace.goToNextPage")}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 p-0 sm:size-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={pending || !table.getCanNextPage()}
            aria-label={t("workspace.goToLastPage")}
          >
            <ChevronsRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
