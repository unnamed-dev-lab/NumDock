import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api, unwrap, errorMessage } from "@/lib/api/client";
import { ActionDialog, WorkspaceTable, State, useFormat } from "./shared";
import { useOperations, type Snapshot } from "./runtime";
function MessageDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const { organization } = useOperations();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const key = ["message", organization?.id, id];
  const message = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const data = unwrap(
        await api.GET(
          "/v1/organizations/{organization_id}/messages/{resource_id}",
          {
            params: {
              path: { organization_id: organization!.id, resource_id: id },
            },
            signal,
          },
        ),
      );
      void client.invalidateQueries({
        queryKey: ["operations", organization?.id],
      });
      return data;
    },
    enabled: open && !!organization,
    retry: 1,
    gcTime: 0,
    staleTime: 0,
  });
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("workspace.opsOpen")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) client.removeQueries({ queryKey: key });
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
  const columns: ColumnDef<Snapshot["messages"][number]>[] = [
    {
      accessorKey: "e164",
      header: t("workspace.opsNumber"),
      cell: ({ row }) => <span className="font-mono">{row.original.e164}</span>,
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
            description={t("workspace.opsDeleteDescription")}
          />
        </div>
      ),
    },
  ];
  return (
    <WorkspaceTable
      view="messages"
      select={(s) => s.messages}
      columns={columns}
      statuses={[
        { value: "unread", label: t("workspace.opsUnread") },
        { value: "read", label: t("workspace.opsRead") },
      ]}
    />
  );
}
