import { PurchaseNumber } from "@/features/operations/numbers";
import { useEffect, useMemo } from "react";
import { Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FlaskConical, LoaderCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/motion/button/base";
import { EmptyState } from "@/features/workspace/workspace-ui";
import { api, ApiError, errorMessage, unwrap } from "@/lib/api/client";
import { getCatalogColumns } from "./columns";
import { CatalogToolbar } from "./catalog-toolbar";
import { useCatalogParams } from "./use-catalog-params";

export function CatalogView() {
  const { t, i18n } = useTranslation();
  const filters = useCatalogParams();
  const { query, update } = filters;
  const columns = useMemo(
    () => [
      ...getCatalogColumns(t, i18n.resolvedLanguage ?? "en"),
      {
        id: "actions",
        enableSorting: false,
        header: () => t("workspace.opsActions"),
        cell: ({
          row,
        }: {
          row: {
            original: { id: string; e164: string; monthly_fee_minor: number };
          };
        }) => (
          <PurchaseNumber
            id={row.original.id}
            e164={row.original.e164}
            price={row.original.monthly_fee_minor}
          />
        ),
      },
    ],
    [t, i18n.resolvedLanguage],
  );
  const catalog = useQuery({
    queryKey: ["catalog", "numbers", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/v1/catalog/numbers", { params: { query }, signal }),
      ),
    staleTime: 30_000,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status < 500) && count < 1,
  });
  useEffect(() => {
    if (!catalog.data || catalog.data.mode !== "mock") return;
    const limit = query.limit ?? 10;
    const lastOffset =
      Math.max(0, Math.ceil(catalog.data.total / limit) - 1) * limit;
    if ((query.offset ?? 0) > lastOffset) update({ offset: lastOffset }, false);
  }, [catalog.data, query.limit, query.offset, update]);
  if (catalog.error instanceof ApiError && catalog.error.status === 401)
    return <Navigate to="/login" replace />;
  return (
    <section
      className="space-y-5"
      aria-label={t("workspace.catalog")}
      aria-busy={catalog.isFetching}
    >
      <CatalogToolbar {...filters} />
      {catalog.isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
        >
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t("workspace.catalogLoading")}
        </p>
      ) : catalog.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-destructive/30 p-4 text-sm text-destructive"
        >
          <p>{errorMessage(catalog.error, t)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void catalog.refetch()}
          >
            {t("workspace.tryAgain")}
          </Button>
        </div>
      ) : catalog.data.mode === "disabled" ? (
        <EmptyState
          icon={FlaskConical}
          title={t("workspace.catalogDisabledTitle")}
          description={t("workspace.catalogDisabledDescription")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={catalog.data.items}
          manual
          rowCount={catalog.data.total}
          emptyState={t("workspace.catalogEmpty")}
          pageIndex={Math.floor((query.offset ?? 0) / (query.limit ?? 10))}
          pageSize={query.limit ?? 10}
          onPaginationChange={(index, size) =>
            update(
              { limit: size, offset: size !== query.limit ? 0 : index * size },
              false,
            )
          }
          sorting={[{ id: query.sort ?? "e164", desc: query.order === "desc" }]}
          onSortingChange={(sorting) =>
            update({
              sort: sorting[0]?.id ?? "e164",
              order: sorting[0]?.desc ? "desc" : "asc",
            })
          }
        />
      )}
    </section>
  );
}
