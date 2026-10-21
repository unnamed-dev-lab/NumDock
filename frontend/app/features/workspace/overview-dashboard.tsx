import { useOperations } from "@/features/operations/runtime";
import { WalletSummary } from "@/features/operations/billing";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TextCascade } from "@/components/motion/text-cascade";
import { overviewQuery } from "./overview-query";
import { Navigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Activity, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, errorMessage, type Identity } from "@/lib/api/client";
import { DetailRow, EmptyState } from "./workspace-ui";
import { OverviewChart } from "./overview-chart";

export function OverviewDashboard({ identity }: { identity: Identity }) {
  const { t, i18n } = useTranslation();
  const { summary: current } = useOperations();
  const [params, setParams] = useSearchParams();
  const organization =
    identity.organizations.find(
      (item) => item.id === params.get("organization"),
    ) ?? identity.organizations[0];
  const days = params.get("days") === "7" ? 7 : 30;
  const setFilter = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const client = useQueryClient();
  const summary = useQuery({
    ...overviewQuery(organization?.id ?? "", days),
    enabled: Boolean(organization),
    // Keep the chart mounted during a period change, never across tenants.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === organization?.id ? previous : undefined,
  });
  useEffect(() => {
    if (
      !organization ||
      summary.data?.mode !== "mock" ||
      summary.isPlaceholderData
    )
      return;
    void client.prefetchQuery(
      overviewQuery(organization.id, days === 7 ? 30 : 7),
    );
  }, [client, organization, days, summary.data, summary.isPlaceholderData]);
  if (summary.error instanceof ApiError && summary.error.status === 401)
    return <Navigate to="/login" replace />;
  if (!organization) return null;
  const ranges = [
    { value: "7", label: t("workspace.overviewSevenDays") },
    { value: "30", label: t("workspace.overviewThirtyDays") },
  ];
  const count = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const data = summary.data;
  const stats = data
    ? [
        {
          id: "numbers",
          label: t("workspace.overviewNumbers"),
          value: count(data.totals.active_numbers),
          note: t("workspace.overviewLatestSnapshot"),
        },
        {
          id: "messages",
          label: t("workspace.overviewReceived"),
          value: count(data.totals.messages_received),
          note: t("workspace.overviewFailedCount", {
            count: data.totals.messages_failed,
          }),
        },
        {
          id: "orders",
          label: t("workspace.overviewOrders"),
          value: count(data.totals.orders_completed),
          note: t("workspace.overviewSelectedPeriod"),
        },
        {
          id: "spend",
          label: t("workspace.overviewSpend"),
          value: new Intl.NumberFormat(i18n.language, {
            style: "currency",
            currency: data.currency,
          }).format(data.totals.spend_minor / 100),
          note: t("workspace.overviewNoWallet"),
        },
      ]
    : [];
  return (
    <section
      className="space-y-5"
      aria-label={t("workspace.overviewDashboard")}
      aria-busy={summary.isFetching}
    >
      {current?.mode === "mock" ? (
        <section
          aria-label={t("workspace.opsCurrentState")}
          className="space-y-3"
        >
          <h2 className="text-base font-semibold">
            {t("workspace.opsCurrentState")}
          </h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <p>
              {t("workspace.opsCurrentNumbers")}:{" "}
              <strong>{current.counts.numbers}</strong>
            </p>
            <p>
              {t("workspace.opsCurrentUnread")}:{" "}
              <strong>{current.counts.unread_messages}</strong>
            </p>
            <p>
              {t("workspace.opsCurrentOrders")}:{" "}
              <strong>{current.counts.completed_orders}</strong>
            </p>
          </div>
          <WalletSummary />
        </section>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">
            {t("workspace.overviewDashboard")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {identity.organizations.length > 1 ? (
            <Select
              items={identity.organizations.map((o) => ({
                value: o.id,
                label: o.name,
              }))}
              value={organization.id}
              onValueChange={(value) => {
                if (value) setFilter("organization", value);
              }}
            >
              <SelectTrigger aria-label={t("workspace.organization")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {identity.organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            items={ranges}
            value={String(days)}
            onValueChange={(value) => {
              if (value) setFilter("days", value);
            }}
          >
            <SelectTrigger aria-label={t("workspace.overviewPeriod")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ranges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={summary.isFetching}
            onClick={() => void summary.refetch()}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {t("workspace.overviewRefresh")}
          </Button>
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-xs text-muted-foreground"
      >
        {summary.isPlaceholderData
          ? t("workspace.overviewUpdating", {
              period: ranges.find((range) => range.value === String(days))!
                .label,
            })
          : null}
      </p>
      {summary.isPending ? (
        <p
          role="status"
          className="flex min-h-40 items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t("workspace.overviewLoading")}
        </p>
      ) : summary.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-destructive/30 p-4"
        >
          <p className="text-sm text-destructive">
            {errorMessage(summary.error, t)}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void summary.refetch()}
          >
            {t("workspace.tryAgain")}
          </Button>
        </div>
      ) : data ? (
        <>
          {data.mode === "mock" ? (
            <>
              <p className="text-xs text-muted-foreground">
                {t("workspace.overviewHistoryLabel")}
              </p>
              <dl
                data-slot="overview-stats"
                className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-card lg:grid-cols-4"
              >
                {stats.map((stat) => (
                  <div key={stat.id} className="min-w-0 px-4 py-5">
                    <dt className="text-xs text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="mt-2 break-words font-mono text-2xl font-semibold tracking-tight tabular-nums">
                      <TextCascade text={stat.value} />
                    </dd>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {stat.note}
                    </p>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <EmptyState
              icon={Activity}
              title={t(
                data.mode === "disabled"
                  ? "workspace.overviewDisabled"
                  : "workspace.overviewEmpty",
              )}
              description={t(
                data.mode === "disabled"
                  ? "workspace.overviewDisabledDescription"
                  : "workspace.overviewEmptyDescription",
              )}
            />
          )}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
            {data.mode === "mock" ? (
              <Card className="min-w-0 rounded-lg shadow-none ring-1 ring-border">
                <CardHeader>
                  <CardTitle className="text-sm">
                    {t("workspace.overviewTrend")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {data.range_start} — {data.range_end} · UTC
                  </p>
                </CardHeader>
                <CardContent>
                  <OverviewChart data={data} />
                </CardContent>
              </Card>
            ) : null}
            <Card className="h-fit rounded-lg shadow-none ring-1 ring-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="size-4" aria-hidden="true" />
                  OpenTelemetry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow
                    label={t("workspace.overviewInstrumentation")}
                    value={t(
                      data.telemetry.instrumented
                        ? "workspace.overviewInstrumented"
                        : "workspace.overviewOtelOff",
                    )}
                  />
                  <DetailRow
                    label={t("workspace.overviewExporter")}
                    value={t(
                      data.telemetry.exporter_configured
                        ? "workspace.overviewExporterConfigured"
                        : "workspace.overviewExporterMissing",
                    )}
                  />
                  <DetailRow
                    label={t("workspace.overviewSignals")}
                    value={t("workspace.overviewTracesMetrics")}
                  />
                </dl>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  {t("workspace.overviewTelemetryNote")}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
