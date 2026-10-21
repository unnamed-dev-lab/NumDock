import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { PhoneCall } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/features/workspace/workspace-ui";
import { CatalogView } from "@/features/catalog/catalog-view";
import { useSearchParams } from "react-router";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.numbers");

export default function NumbersRoute() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") === "catalog" ? "catalog" : "numbers";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.telephony")}
        title={t("workspace.numbers")}
        description={t(
          "workspace.provisionAndManageAuthorizedVirtualNumbersInventory",
        )}
        status={
          <StatusBadge tone="neutral">
            {t("workspace.provisioningNotEnabled")}
          </StatusBadge>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          if (val === "numbers" || val === "catalog") {
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.set("tab", val);
                return next;
              },
              { preventScrollReset: true },
            );
          }
        }}
        className="flex-col gap-4"
      >
        <TabsList variant="line" aria-label={t("workspace.numberViews")}>
          <TabsTrigger value="numbers">
            {t("workspace.yourNumbers")}
          </TabsTrigger>
          <TabsTrigger value="catalog">{t("workspace.catalog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="numbers" className="pt-4">
          <EmptyState
            icon={PhoneCall}
            title={t("workspace.noNumbersYet")}
            description={t("workspace.numberProvisioningIsNotEnabledInThis")}
          />
        </TabsContent>

        <TabsContent value="catalog" className="pt-4">
          <CatalogView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
