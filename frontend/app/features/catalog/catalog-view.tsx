import { PurchaseNumber } from "@/features/operations/numbers";
import { useEffect, useMemo } from "react";
import { Navigate, useNavigate } from "react-router";
import { useCatalogNumbers, type CatalogInitial } from "@/hooks/api/catalog";
import { useTranslation } from "react-i18next";
import { AlertCircle, FlaskConical } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/motion/button/base";
import { EmptyState } from "@/features/workspace/workspace-ui";
import { ApiError, errorMessage } from "@/lib/api/client";
import { getCatalogColumns } from "./columns";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CatalogToolbar } from "./catalog-toolbar";
import { useCatalogParams } from "./use-catalog-params";

export function CatalogView({
  publicBrowsing = false,
  initial,
}: {
  publicBrowsing?: boolean;
  initial?: CatalogInitial | null;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const filters = useCatalogParams();
  const { query, update } = filters;
  const columns = useMemo(
    () => [
      ...getCatalogColumns(t, i18n.resolvedLanguage ?? "en"),
      {
        id: "actions",
        meta: { label: t("workspace.opsActions") },
        enableSorting: false,
        header: () => t("workspace.opsActions"),
        cell: ({
          row,
        }: {
          row: {
            original: Pick<
              import("./types").VirtualNumberCatalogItem,
              "id" | "e164" | "rental_options"
            >;
          };
        }) =>
          publicBrowsing ? (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 md:min-h-9"
              onClick={() =>
                void navigate(
                  "/app/numbers?tab=catalog&q=" +
                    encodeURIComponent(row.original.e164),
                )
              }
            >
              {t("home.chooseNumber")}
            </Button>
          ) : (
            <PurchaseNumber
              id={row.original.id}
              e164={row.original.e164}
              options={row.original.rental_options}
            />
          ),
      },
    ],
    [t, i18n.resolvedLanguage, publicBrowsing, navigate],
  );
  const catalog = useCatalogNumbers(query, initial);
  useEffect(() => {
    if (
      !catalog.data ||
      catalog.isPlaceholderData ||
      catalog.data.mode !== "mock"
    )
      return;
    const limit = query.limit ?? 10;
    const lastOffset =
      Math.max(0, Math.ceil(catalog.data.total / limit) - 1) * limit;
    if ((query.offset ?? 0) > lastOffset) update({ offset: lastOffset }, false);
  }, [
    catalog.data,
    catalog.isPlaceholderData,
    query.limit,
    query.offset,
    update,
  ]);
  if (catalog.error instanceof ApiError && catalog.error.status === 401)
    return <Navigate to="/login" replace />;
  const serviceUnavailable =
    catalog.error instanceof ApiError &&
    (catalog.error.code === "not_ready" || catalog.error.status >= 500);
  return (
    <section
      className="space-y-5"
      aria-label={t("workspace.catalog")}
      aria-busy={catalog.isFetching}
    >
      <CatalogToolbar {...filters} />
      {catalog.data?.mode === "mock" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("workspace.useCaseDisclaimer")}
        </p>
      ) : null}
      {publicBrowsing && catalog.data?.mode === "mock" ? (
        <p className="text-xs text-muted-foreground">
          {t("home.developmentCatalog")}
        </p>
      ) : null}
      {catalog.isPending ? (
        <CatalogSkeleton label={t("workspace.catalogLoading")} />
      ) : catalog.isError ? (
        <div role="alert">
          <EmptyState
            icon={AlertCircle}
            title={t("workspace.catalogErrorTitle")}
            description={errorMessage(catalog.error, t)}
          >
            {import.meta.env.DEV && serviceUnavailable ? (
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                {t("workspace.catalogErrorDevHint")}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void catalog.refetch()}
            >
              {t("workspace.tryAgain")}
            </Button>
          </EmptyState>
        </div>
      ) : catalog.data.mode === "disabled" ? (
        <EmptyState
          icon={FlaskConical}
          title={t("workspace.catalogDisabledTitle")}
          description={t("workspace.catalogDisabledDescription")}
        />
      ) : (
        <DataTable
          pending={catalog.isPlaceholderData}
          label={t("workspace.catalog")}
          getRowId={(row) => row.id}
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
