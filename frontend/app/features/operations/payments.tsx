import { useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { usePayment } from "@/hooks/api/billing";
import { useCommandMutation } from "@/hooks/api/commands";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/motion/button/base";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/features/workspace/workspace-ui";
import { errorMessage } from "@/lib/api/client";
import { workspaceReturnTo } from "@/features/auth/return-to";
import { useOperations, type ResourceItems } from "./runtime";
import { WorkspaceTable, useFormat } from "./shared";

function PaymentStatus({
  value,
}: {
  value: ResourceItems["payments"][number]["status"];
}) {
  const { t } = useTranslation();
  const labels = {
    pending: "workspace.paymentPending",
    succeeded: "workspace.paymentSucceeded",
    failed: "workspace.paymentFailedStatus",
    canceled: "workspace.paymentCanceled",
    expired: "workspace.opsExpired",
  } as const;
  return (
    <StatusBadge
      tone={
        value === "succeeded"
          ? "active"
          : value === "failed"
            ? "warning"
            : "neutral"
      }
    >
      {t(labels[value])}
    </StatusBadge>
  );
}
export function PaymentCheckout() {
  const [params] = useSearchParams();
  const { organization } = useOperations();
  const reference = params.get("payment");
  return reference && organization ? (
    <Checkout
      key={organization.id + reference}
      org={organization.id}
      reference={reference}
    />
  ) : null;
}
function Checkout({ org, reference }: { org: string; reference: string }) {
  const { t } = useTranslation();
  const { money, date } = useFormat();
  const [params] = useSearchParams();
  const payment = usePayment(org, reference);
  const keys = useRef({
    pay: crypto.randomUUID(),
    cancel: crypto.randomUUID(),
  });
  const running = useRef(false);
  const mutation = useCommandMutation({
    onSettled: () => {
      running.current = false;
    },
  });
  const submit = (action: "pay" | "cancel") => {
    if (running.current) return;
    running.current = true;
    const order = payment.data;
    if (!order) {
      running.current = false;
      return;
    }
    mutation.mutate({
      org,
      action: action === "pay" ? "pay_payment" : "cancel_payment",
      body: {},
      key: keys.current[action],
      id: order.id,
    });
  };
  const order = payment.data;
  return (
    <Card
      className="shadow-none ring-1 ring-border"
      aria-labelledby="payment-title"
    >
      <CardHeader>
        <CardTitle>
          <h2 id="payment-title">{t("workspace.paymentCheckout")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {payment.isPending ? (
          <p role="status">{t("workspace.opsLoading")}</p>
        ) : payment.isError ? (
          <div role="alert" className="space-y-3 text-sm text-destructive">
            <p>{errorMessage(payment.error, t)}</p>
            <Button variant="outline" onClick={() => void payment.refetch()}>
              {t("workspace.tryAgain")}
            </Button>
          </div>
        ) : !order ? (
          <p role="alert">{t("workspace.paymentNotFound")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("workspace.paymentAmount")}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {money(order.amount_minor)}
                </p>
              </div>
              <PaymentStatus value={order.status} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">
                  {t("workspace.paymentReference")}
                </dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {order.reference}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t("workspace.paymentExpires")}
                </dt>
                <dd className="mt-1">{date(order.expires_at)}</dd>
              </div>
            </dl>
            {order.status === "pending" ? (
              <>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("workspace.paymentDevelopment")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => submit("pay")}
                  >
                    {mutation.isPending
                      ? t("workspace.opsWorking")
                      : t("workspace.paymentPay")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => submit("cancel")}
                  >
                    {t("workspace.paymentCancel")}
                  </Button>
                </div>
              </>
            ) : (
              <div role="status" className="space-y-3">
                <p className="text-sm">
                  {t(
                    order.status === "succeeded"
                      ? "workspace.paymentPaid"
                      : order.status === "failed"
                        ? "workspace.paymentFailed"
                        : order.status === "expired"
                          ? "workspace.paymentExpired"
                          : "workspace.paymentCanceledDescription",
                  )}
                </p>
                <Link
                  to={
                    params.get("returnTo")
                      ? workspaceReturnTo(params.get("returnTo"))
                      : "/app/numbers?tab=catalog"
                  }
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("workspace.paymentContinue")}
                </Link>
              </div>
            )}
            {mutation.isError && order.status === "pending" ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(mutation.error, t)}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
export function PaymentHistory() {
  const { t } = useTranslation();
  const { money, date } = useFormat();
  const [, setParams] = useSearchParams();
  const columns = useMemo<ColumnDef<ResourceItems["payments"][number]>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("workspace.paymentReference"),
        cell: ({ row }) => (
          <span className="break-all font-mono text-xs">
            {row.original.reference}
          </span>
        ),
      },
      {
        accessorKey: "amount_minor",
        header: t("workspace.paymentAmount"),
        cell: ({ row }) => money(row.original.amount_minor),
      },
      {
        accessorKey: "status",
        header: t("workspace.opsStatus"),
        cell: ({ row }) => <PaymentStatus value={row.original.status} />,
      },
      {
        accessorKey: "created_at",
        header: t("workspace.opsCreated"),
        cell: ({ row }) => date(row.original.created_at),
      },
      {
        id: "actions",
        header: t("workspace.opsActions"),
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() =>
              setParams(
                (p) => {
                  const n = new URLSearchParams(p);
                  n.set("payment", row.original.reference);
                  return n;
                },
                { preventScrollReset: true },
              )
            }
          >
            {t(
              row.original.status === "pending"
                ? "workspace.paymentResume"
                : "workspace.paymentDetails",
            )}
          </Button>
        ),
      },
    ],
    [t, money, date, setParams],
  );
  return (
    <WorkspaceTable
      view="payments"
      columns={columns}
      statuses={[
        { value: "pending", label: t("workspace.paymentPending") },
        { value: "succeeded", label: t("workspace.paymentSucceeded") },
        { value: "failed", label: t("workspace.paymentFailedStatus") },
        { value: "canceled", label: t("workspace.paymentCanceled") },
        { value: "expired", label: t("workspace.opsExpired") },
      ]}
    />
  );
}
