import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useResourceList, type ResourceItems } from "@/hooks/api/resources";
import { useRefreshAccount } from "@/hooks/api/cache";
import { useCommandMutation } from "@/hooks/api/commands";
import { useSearchParams, Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge, InlineNote } from "@/features/workspace/workspace-ui";
import { AlertCircle, Check } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { TranslationKey } from "@/lib/i18n";
import { useOperations, type Action, type Command, type View } from "./runtime";
export function ModeNotice() {
  const { t } = useTranslation();
  const { summary, summaryError, organization } = useOperations();
  const refreshAccount = useRefreshAccount(organization?.id ?? "");
  if (!summaryError && summary?.mode !== "disabled") return null;
  return (
    <div className="mb-6">
      <InlineNote icon={AlertCircle}>
        <span role={summaryError ? "alert" : undefined}>
          {t(
            summaryError
              ? "workspace.opsConnectionFailed"
              : "workspace.opsDisabled",
          )}
        </span>
        {summaryError ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => void refreshAccount()}
          >
            {t("workspace.tryAgain")}
          </Button>
        ) : null}
      </InlineNote>
    </div>
  );
}
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const money = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    });
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
    return {
      money: (minor: number) => money.format(minor / 100),
      date: (value: string) => date.format(new Date(value)) + " UTC",
    };
  }, [locale]);
}
const statusKeys: Record<string, TranslationKey> = {
  active: "workspace.active",
  released: "workspace.opsReleased",
  expired: "workspace.opsExpired",
  completed: "workspace.opsCompleted",
  failed: "workspace.opsFailed",
  refunded: "workspace.opsRefunded",
  pending: "workspace.opsPending",
  succeeded: "workspace.opsSucceeded",
  disabled: "workspace.opsDisabledStatus",
  revoked: "workspace.opsRevoked",
  read: "workspace.opsRead",
  unread: "workspace.opsUnread",
  mock_credit: "workspace.opsCredit",
  payment_credit: "workspace.opsCredit",
  canceled: "workspace.paymentCanceled",
  reserve: "workspace.opsReserve",
  settle: "workspace.opsSettle",
  release: "workspace.opsUnreserve",
  refund: "workspace.opsRefund",
};
export function State({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={
        value === "active" || value === "succeeded" || value === "completed"
          ? "active"
          : value === "failed"
            ? "warning"
            : "neutral"
      }
    >
      {t(statusKeys[value] ?? "workspace.opsPending")}
    </StatusBadge>
  );
}
export type FormField = {
  name: string;
  label: TranslationKey;
  type?: "number" | "money" | "switch" | "select";
  default?: string | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: RegExp;
};
export function ActionDialog({
  action,
  id,
  title,
  fields = [],
  build = () => ({}),
  children,
  description,
  onComplete,
}: {
  action: Action;
  id?: string;
  title: string;
  fields?: FormField[];
  build?: (v: Record<string, string | boolean>) => Command;
  children?: ReactNode;
  description?: string;
  onComplete?: (result: import("./runtime").Result) => void;
}) {
  const { t } = useTranslation();
  const { organization, summary } = useOperations();
  const [open, setOpen] = useState(false);
  const target = useRef({ build, id, org: organization?.id, onComplete });
  const directFingerprint = useRef("");
  const key = useRef("");
  const running = useRef(false);
  const immediate = action === "simulate";
  const [openedDescription, setOpenedDescription] = useState(description);
  const schema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.type === "switch"
          ? z.boolean()
          : z
              .string()
              .min(1, t("workspace.opsRequired"))
              .refine(
                (v) =>
                  (f.type !== "number" && f.type !== "money") ||
                  ((f.type === "money" ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/).test(
                    v,
                  ) &&
                    Number(v) >= (f.min ?? 1) &&
                    Number(v) <= (f.max ?? 1000000)),
                t("workspace.opsInvalid"),
              )
              .refine(
                (v) => !f.maxLength || v.length <= f.maxLength,
                t("workspace.opsInvalid"),
              )
              .refine(
                (v) => !f.pattern || f.pattern.test(v),
                t("workspace.opsInvalid"),
              ),
      ]),
    ),
  );
  const form = useForm<Record<string, string | boolean>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.default ?? (f.type === "switch" ? false : ""),
      ]),
    ),
  });
  const mutation = useCommandMutation({
    onSuccess: (result) => {
      if (result.status !== "failed") {
        setOpen(false);
        target.current.onComplete?.(result);
      }
    },
    onSettled: () => {
      running.current = false;
    },
  });
  const submitAction = (values: Record<string, string | boolean>) => {
    if (running.current) return;
    running.current = true;
    mutation.mutate({
      org: target.current.org!,
      action,
      body: target.current.build(values),
      key: key.current,
      id: target.current.id,
    });
  };
  const disabled =
    !organization || organization.role === "member" || summary?.mode !== "mock";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 sm:min-h-9"
        disabled={disabled || mutation.isPending}
        onClick={() => {
          if (running.current) return;
          const command = immediate ? build({}) : undefined;
          const fingerprint = JSON.stringify([
            action,
            organization?.id,
            id,
            command,
          ]);
          // Retrying an uncertain response reuses the command's idempotency key.
          if (
            !immediate ||
            !mutation.isError ||
            directFingerprint.current !== fingerprint
          )
            key.current = crypto.randomUUID();
          directFingerprint.current = fingerprint;
          form.reset();
          mutation.reset();
          setOpenedDescription(description);
          target.current = {
            build: command ? () => command : build,
            id,
            org: organization?.id,
            onComplete,
          };
          if (immediate) submitAction({});
          else setOpen(true);
        }}
      >
        {immediate && mutation.isSuccess ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : null}
        {mutation.isPending ? t("workspace.opsWorking") : (children ?? title)}
      </Button>
      {immediate && mutation.isError ? (
        <span role="alert" className="text-xs text-destructive">
          {errorMessage(mutation.error, t)}
        </span>
      ) : null}
      {immediate && mutation.isSuccess ? (
        <span role="status" className="sr-only">
          {t("workspace.opsSuccess")}
        </span>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) {
            setOpen(v);
            if (!v) mutation.reset();
          }
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {openedDescription ?? t("workspace.opsConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          {mutation.isSuccess ? (
            <div className="space-y-4">
              <p role="status">
                {t(
                  mutation.data.status === "failed"
                    ? "workspace.opsFailureCompensated"
                    : "workspace.opsSuccess",
                )}
              </p>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                    mutation.reset();
                  }}
                >
                  {t("common.close")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(submitAction)}
            >
              {fields.map((f) => (
                <Controller
                  key={f.name}
                  name={f.name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <div className="space-y-1.5">
                      {f.type === "switch" ? (
                        <label className="flex items-start gap-3 text-sm">
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            aria-label={t(f.label)}
                          />
                          {t(f.label)}
                        </label>
                      ) : f.type === "select" ? (
                        <>
                          <label
                            htmlFor={`ops-${f.name}`}
                            className="text-sm font-medium"
                          >
                            {t(f.label)}
                          </label>
                          <Select
                            value={String(field.value)}
                            onValueChange={field.onChange}
                            items={f.options}
                          >
                            <SelectTrigger
                              id={`ops-${f.name}`}
                              className="w-full"
                            >
                              <SelectValue placeholder={t(f.label)} />
                            </SelectTrigger>
                            <SelectContent>
                              {f.options?.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <Input
                          {...field}
                          value={String(field.value)}
                          label={t(f.label)}
                          type={f.type === "number" ? "number" : "text"}
                          inputMode={f.type === "money" ? "decimal" : undefined}
                          min={f.min}
                          max={f.max}
                          maxLength={f.maxLength}
                          error={fieldState.error?.message}
                        />
                      )}
                      {fieldState.error &&
                      f.type !== undefined &&
                      f.type !== "number" &&
                      f.type !== "money" ? (
                        <p role="alert" className="text-xs text-destructive">
                          {fieldState.error.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              ))}
              {mutation.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(mutation.error, t)}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => setOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {t(
                    mutation.isPending
                      ? "workspace.opsWorking"
                      : "workspace.opsConfirm",
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function WorkspaceTable<R extends View>({
  view,
  columns,
  statuses = [],
  toolbar,
}: {
  view: R;
  columns: ColumnDef<ResourceItems[R][number]>[];
  statuses?: { value: string; label: string }[];
  toolbar?: ReactNode;
}) {
  const { t } = useTranslation();
  const { organization, summaryError } = useOperations();
  const refreshAccount = useRefreshAccount(organization?.id ?? "");
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get(`${view}Offset`) ?? 0);
  const offset = Number.isInteger(raw) && raw >= 0 ? Math.min(raw, 100000) : 0;
  const status = params.get(`${view}Status`) ?? "";
  const requestedLimit = Number(params.get(`${view}Limit`) ?? 20);
  const limit = [10, 20, 30, 50].includes(requestedLimit) ? requestedLimit : 20;
  const search =
    view === "numbers" ? (params.get("numbersSearch") ?? "").slice(0, 80) : "";
  const query = useResourceList(organization?.id ?? "", view, {
    limit,
    offset,
    status,
    q: search,
  });
  const update = (name: string, value: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set(name, value);
        if (name !== `${view}Offset`) n.delete(`${view}Offset`);
        return n;
      },
      { replace: true, preventScrollReset: true },
    );
  useEffect(() => {
    if (!query.data || query.isPlaceholderData) return;
    const last = Math.max(0, Math.ceil(query.data.total / limit) - 1) * limit;
    if (offset > last)
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set(`${view}Offset`, String(last));
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
  }, [query.data, query.isPlaceholderData, limit, offset, view, setParams]);
  if (query.error instanceof ApiError && query.error.status === 401)
    return <Navigate to="/login" replace />;
  return (
    <section className="space-y-4" aria-busy={query.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {statuses.length ? (
          <Select
            value={status}
            onValueChange={(v) => update(`${view}Status`, v ?? "")}
            items={[{ value: "", label: t("workspace.opsAll") }, ...statuses]}
          >
            <SelectTrigger
              className="h-11 sm:h-9"
              aria-label={t("workspace.opsFilterStatus")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t("workspace.opsAll")}</SelectItem>
              {statuses.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span />
        )}
        {view === "numbers" ? (
          <Input
            aria-label={t("workspace.opsSearch")}
            placeholder={t("workspace.opsSearch")}
            value={search}
            onChange={(v) => update("numbersSearch", v)}
            maxLength={80}
            className="w-full sm:w-64"
          />
        ) : null}
        {toolbar}
      </div>
      {query.isPending ? (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          {t("workspace.opsLoading")}
        </p>
      ) : query.isError && summaryError ? null : query.isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive">
            {errorMessage(query.error, t)}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch();
              void refreshAccount();
            }}
          >
            {t("workspace.tryAgain")}
          </Button>
        </div>
      ) : query.data.mode === "disabled" ? null : (
        <DataTable
          data={query.data.items}
          columns={columns}
          getRowId={(row) => row.id}
          pending={query.isPlaceholderData}
          manual
          rowCount={query.data.total}
          pageIndex={Math.floor(offset / limit)}
          pageSize={limit}
          onPaginationChange={(index, size) =>
            setParams(
              (p) => {
                const next = new URLSearchParams(p);
                next.set(`${view}Limit`, String(size));
                next.set(
                  `${view}Offset`,
                  String(size !== limit ? 0 : index * size),
                );
                return next;
              },
              { preventScrollReset: true },
            )
          }
          emptyState={t("workspace.opsEmpty")}
        />
      )}
    </section>
  );
}
