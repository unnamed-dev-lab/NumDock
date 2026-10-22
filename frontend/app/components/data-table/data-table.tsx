import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type TableOptions,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTablePagination } from "./data-table-pagination";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  toolbar?: (table: TanStackTable<TData>) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  defaultPageSize?: number;
  manual?: boolean;
  paginate?: boolean;
  responsiveRows?: boolean;
  pending?: boolean;
  label?: string;
  scrollClassName?: string;
  getRowId?: TableOptions<TData>["getRowId"];
  rowCount?: number;

  // Optional external controlled states (e.g. for Zustand persistence)
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  globalFilter?: string;
  onGlobalFilterChange?: (filter: string) => void;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  toolbar,
  emptyState,
  className,
  defaultPageSize = 10,
  manual = false,
  paginate = true,
  responsiveRows = true,
  pending = false,
  label,
  scrollClassName,
  getRowId,
  rowCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  columnFilters: columnFiltersProp,
  onColumnFiltersChange,
  sorting: sortingProp,
  onSortingChange,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation();
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    [],
  );
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] =
    React.useState<string>("");
  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const pagination = React.useMemo(() => {
    if (pageIndex !== undefined && pageSize !== undefined) {
      return { pageIndex, pageSize };
    }
    return internalPagination;
  }, [pageIndex, pageSize, internalPagination]);

  const activeSorting = sortingProp ?? internalSorting;
  const activeColumnFilters = columnFiltersProp ?? internalColumnFilters;
  const activeGlobalFilter = globalFilterProp ?? internalGlobalFilter;

  const table = useReactTable({
    data,
    columns,
    getRowId,
    enableSorting: !manual || !!onSortingChange,
    state: {
      sorting: activeSorting,
      columnFilters: activeColumnFilters,
      globalFilter: activeGlobalFilter,
      pagination,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(activeSorting) : updater;
      if (onSortingChange) onSortingChange(next);
      else setInternalSorting(next);
    },
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(activeColumnFilters) : updater;
      if (onColumnFiltersChange) onColumnFiltersChange(next);
      else setInternalColumnFilters(next);
    },
    onGlobalFilterChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(activeGlobalFilter) : updater;
      if (onGlobalFilterChange) onGlobalFilterChange(next);
      else setInternalGlobalFilter(next);
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      if (onPaginationChange) {
        onPaginationChange(next.pageIndex, next.pageSize);
      } else {
        setInternalPagination(next);
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: manual || !paginate,
    manualFiltering: manual,
    manualSorting: manual,
    rowCount,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: paginate ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
  });

  const sortOptions = [
    { value: "none", label: t("workspace.tableDefaultOrder") },
    ...table
      .getAllLeafColumns()
      .filter((column) => column.getCanSort())
      .flatMap((column) => {
        const label =
          column.columnDef.meta?.label ??
          (typeof column.columnDef.header === "string"
            ? column.columnDef.header
            : column.id);
        return ["asc", "desc"].map((direction) => ({
          value: `${column.id}:${direction}`,
          label: t("workspace.tableSortOption", {
            column: label,
            direction: t(
              direction === "asc"
                ? "workspace.tableAscending"
                : "workspace.tableDescending",
            ),
          }),
        }));
      }),
  ];
  return (
    <div
      data-slot="data-table"
      aria-busy={pending}
      className={cn("space-y-4", className)}
    >
      {toolbar ? toolbar(table) : null}
      {responsiveRows &&
      sortOptions.length > 1 &&
      (rowCount ?? data.length) > 1 ? (
        <div className="md:hidden">
          <Select
            items={sortOptions}
            disabled={pending}
            value={
              activeSorting[0]
                ? `${activeSorting[0].id}:${activeSorting[0].desc ? "desc" : "asc"}`
                : "none"
            }
            onValueChange={(value) => {
              if (value === "none") table.setSorting([]);
              else if (
                value &&
                sortOptions.some((option) => option.value === value)
              ) {
                const [id, direction] = value.split(":");
                if (id) table.setSorting([{ id, desc: direction === "desc" }]);
              }
            }}
          >
            <SelectTrigger
              className="h-11 w-full"
              aria-label={t("workspace.tableSort")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table
          aria-label={label}
          containerClassName={scrollClassName}
          containerLabel={scrollClassName ? label : undefined}
          className={cn(responsiveRows && "block md:table")}
        >
          <TableHeader
            className={cn(
              responsiveRows && "hidden md:table-header-group",
              scrollClassName && "sticky top-0 z-10 bg-card",
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-border hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                    className={cn(
                      "h-10 text-muted-foreground",
                      header.column.columnDef.meta?.align === "right" &&
                        "text-right",
                      header.column.id === "actions" &&
                        "sticky right-0 z-10 border-l border-border bg-card",
                    )}
                  >
                    {header.isPlaceholder ? null : typeof header.column
                        .columnDef.header === "string" &&
                      header.column.getCanSort() ? (
                      <DataTableColumnHeader
                        column={header.column}
                        title={header.column.columnDef.header}
                        className={
                          header.column.columnDef.meta?.align === "right"
                            ? "justify-end"
                            : undefined
                        }
                      />
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            inert={pending}
            className={cn(responsiveRows && "block md:table-row-group")}
          >
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-row-id={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "border-border/60 transition-colors md:hover:bg-muted/50",
                    responsiveRows && "block p-4 md:table-row md:p-0",
                  )}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const actions = cell.column.id === "actions";
                    const meta = cell.column.columnDef.meta;
                    const columnLabel =
                      meta?.label ??
                      (typeof cell.column.columnDef.header === "string"
                        ? cell.column.columnDef.header
                        : cell.column.id);
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "py-3",
                          meta?.align === "right" && "md:text-right",
                          responsiveRows &&
                            "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start gap-3 whitespace-normal px-0 py-1.5 md:table-cell md:whitespace-nowrap md:px-2 md:py-3",
                          responsiveRows && index === 0 && "block pb-3",
                          actions &&
                            "md:sticky md:right-0 md:z-10 md:border-l md:border-border md:bg-card",
                          responsiveRows &&
                            actions &&
                            "mt-3 block border-t border-border pt-3 md:mt-0 md:border-t-0 md:pt-3",
                        )}
                      >
                        {responsiveRows && index !== 0 && !actions ? (
                          <span className="text-xs text-muted-foreground md:hidden">
                            {columnLabel}
                          </span>
                        ) : null}
                        <div className="min-w-0 [overflow-wrap:anywhere] [&>div]:flex-wrap">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          ) ?? "—"}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {emptyState ?? t("workspace.noMatchingData")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {paginate ? (
        <DataTablePagination table={table} pending={pending} />
      ) : null}
    </div>
  );
}
