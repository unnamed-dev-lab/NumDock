import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/features/workspace/workspace-ui";
import { MessagesTable } from "@/features/operations/messages";
export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.messages");
export default function Route() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("workspace.messages")}
        description={t("workspace.opsMessagesDescription")}
      />
      <MessagesTable />
    </div>
  );
}
