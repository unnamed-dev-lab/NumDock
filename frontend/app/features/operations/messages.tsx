import { useMemo, useState } from "react";
import { useMessage } from "@/hooks/api/messages";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/motion/button/base";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/client";
import { ActionDialog, WorkspaceTable, State, useFormat } from "./shared";
import { useOperations, type ResourceItems } from "./runtime";
function MessageDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const { organization } = useOperations();
  const [open, setOpen] = useState(false);
  const message = useMessage(organization?.id ?? "", id, open);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 sm:min-h-9"
        onClick={() => setOpen(true)}
      >
        {t("workspace.opsOpen")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.opsMessageBody")}</DialogTitle>
            <DialogDescription>
              {t("workspace.opsMessagePrivacy")}
            </DialogDescription>
          </DialogHeader>
          {message.isPending ? (
            <p role="status">{t("workspace.opsLoading")}</p>
          ) : message.isError ? (
            <p role="alert" className="text-destructive">
              {errorMessage(message.error, t)}
            </p>
          ) : (
            <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-4 leading-7">
              {message.data.body}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function MessagesTable() {
  const { t } = useTranslation();
  const { date } = useFormat();
  const columns = useMemo<ColumnDef<ResourceItems["messages"][number]>[]>(
    () => [
      {
        accessorKey: "e164",
        header: t("workspace.opsNumber"),
        cell: ({ row }) => (
          <span className="font-mono">{row.original.e164}</span>
        ),
      },
      {
        accessorKey: "read",
        header: t("workspace.opsStatus"),
        cell: ({ row }) => (
          <State value={row.original.read ? "read" : "unread"} />
        ),
      },
      {
        accessorKey: "received_at",
        header: t("workspace.opsReceived"),
        cell: ({ row }) => date(row.original.received_at),
      },
      {
        accessorKey: "expires_at",
        header: t("workspace.opsExpires"),
        cell: ({ row }) => date(row.original.expires_at),
      },
      {
        id: "actions",
        header: t("workspace.opsActions"),
        cell: ({ row }) => (
          <div className="flex gap-2">
            <MessageDetail id={row.original.id} />
            <ActionDialog
              action="delete_message"
              id={row.original.id}
              title={t("workspace.opsDelete")}
              description={t("workspace.opsDeleteDescription", {
                number: row.original.e164,
              })}
            />
          </div>
        ),
      },
    ],
    [t, date],
  );
  return (
    <WorkspaceTable
      view="messages"
      columns={columns}
      statuses={[
        { value: "unread", label: t("workspace.opsUnread") },
        { value: "read", label: t("workspace.opsRead") },
      ]}
    />
  );
}
