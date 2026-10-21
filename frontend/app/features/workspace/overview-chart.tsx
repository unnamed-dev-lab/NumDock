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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <div
          className="max-h-60 overflow-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-ring"
          tabIndex={0}
          role="region"
          aria-label={t("workspace.overviewDailyRows")}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>{t("workspace.overviewDate")}</TableHead>
                <TableHead className="text-right">
                  {t("workspace.overviewReceived")}
                </TableHead>
                <TableHead className="text-right">
                  {t("workspace.overviewFailed")}
                </TableHead>
                <TableHead className="text-right">
                  {t("workspace.overviewOrders")}
                </TableHead>
                <TableHead className="text-right">
                  {t("workspace.overviewSpend")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.series].reverse().map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="whitespace-nowrap">
                    {date(day.date)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {count(day.messages_received)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {count(day.messages_failed)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {count(day.orders_completed)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {price(day.spend_minor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
});
