import { OverviewDashboard } from "./overview-dashboard";
import { useTranslation } from "react-i18next";
import { PageHeader } from "./workspace-ui";

export function WorkspaceOverview() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <PageHeader
        title={t("workspace.personalOverview")}
        description={t("workspace.overviewDescription")}
      />
      <OverviewDashboard />
    </div>
  );
}
