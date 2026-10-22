import { memo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import type { components } from "@/lib/api/schema";

type Overview = components["schemas"]["Overview"];

export const OverviewChart = memo(function OverviewChart({
  data,
}: {
  data: Overview;
}) {
  const { t, i18n } = useTranslation();
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  const count = (value: number) =>
    new Intl.NumberFormat(i18n.language).format(value);
  const price = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: data.currency,
    }).format(value / 100);
  const columns: ColumnDef<Overview["series"][number]>[] = [
    {
      accessorKey: "date",
      header: t("workspace.overviewDate"),
      cell: ({ row }) => date(row.original.date),
    },
    {
      accessorKey: "messages_received",
      header: t("workspace.overviewReceived"),
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {count(row.original.messages_received)}
        </span>
      ),
    },
    {
      accessorKey: "messages_failed",
      header: t("workspace.overviewFailed"),
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {count(row.original.messages_failed)}
        </span>
      ),
    },
    {
      accessorKey: "orders_completed",
      header: t("workspace.overviewOrders"),
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {count(row.original.orders_completed)}
        </span>
      ),
    },
    {
      accessorKey: "spend_minor",
      header: t("workspace.overviewSpend"),
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {price(row.original.spend_minor)}
        </span>
      ),
    },
  ];
  const config = {
    messages_received: {
      label: t("workspace.overviewReceived"),
      color: "var(--primary)",
    },
    messages_failed: {
      label: t("workspace.overviewFailed"),
      color: "var(--destructive)",
    },
  } satisfies ChartConfig;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="w-5 border-t-2 border-primary" aria-hidden="true" />
          {t("workspace.overviewReceived")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-5 border-t-2 border-dashed border-destructive"
            aria-hidden="true"
          />
          {t("workspace.overviewFailed")}
        </span>
        <span className="sm:ml-auto">{t("workspace.overviewUtc")}</span>
      </div>
      <ChartContainer
        config={config}
        className="h-64 w-full aspect-auto"
        aria-label={t("workspace.overviewTrend")}
      >
        <ComposedChart
          accessibilityLayer
          data={data.series}
          margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
          aria-label={t("workspace.overviewTrend")}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={40}
            tickFormatter={date}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            allowDecimals={false}
            tickFormatter={count}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => date(String(value))}
                formatter={(value, name) => (
                  <>
                    <span className="text-muted-foreground">
                      {name === "messages_received"
                        ? t("workspace.overviewReceived")
                        : t("workspace.overviewFailed")}
                    </span>
                    <span className="ml-3 font-mono tabular-nums">
                      {count(Number(value))}
                    </span>
                  </>
                )}
              />
            }
          />
          <Area
            type="linear"
            dataKey="messages_received"
            stroke="var(--color-messages_received)"
            fill="var(--color-messages_received)"
            fillOpacity={0.1}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="messages_failed"
            stroke="var(--color-messages_failed)"
            strokeDasharray="5 4"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <section
        className="space-y-2"
        aria-label={t("workspace.overviewDailyRows")}
      >
        <h3 className="text-sm font-medium">
          {t("workspace.overviewDailyRows")}
        </h3>
        <DataTable
          label={t("workspace.overviewDailyRows")}
          columns={columns}
          data={[...data.series].reverse()}
          getRowId={(row) => row.date}
          paginate={false}
          responsiveRows={false}
          scrollClassName="max-h-60 overflow-auto focus-visible:outline-2 focus-visible:outline-ring"
        />
      </section>
    </div>
  );
});
