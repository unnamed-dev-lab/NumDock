import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/features/workspace/workspace-ui";
import { DeveloperTables } from "@/features/operations/developers";
export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.apiWebhooks");
export default function Route() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("workspace.apiWebhooks")}
        description={t("workspace.opsDeveloperDescription")}
      />
      <DeveloperTables />
    </div>
  );
}
