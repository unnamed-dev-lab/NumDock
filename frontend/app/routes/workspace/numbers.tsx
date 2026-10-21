import { Button } from "@/components/motion/button/base";
import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { NumbersTable } from "@/features/operations/numbers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/features/workspace/workspace-ui";
import { CatalogView } from "@/features/catalog/catalog-view";
import { useSearchParams } from "react-router";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.numbers");

export default function NumbersRoute() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") === "catalog" ? "catalog" : "numbers";

  const setTab = (tab: string) => {
    if (tab !== "numbers" && tab !== "catalog") return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("tab", tab);
        return next;
      },
      { preventScrollReset: true },
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.telephony")}
        title={t("workspace.numbers")}
        description={t(
          "workspace.provisionAndManageAuthorizedVirtualNumbersInventory",
        )}
        actions={
          activeTab === "numbers" ? (
            <Button size="sm" onClick={() => setTab("catalog")}>
              {t("workspace.opsPurchase")}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={activeTab} onValueChange={setTab} className="flex-col gap-4">
        <TabsList variant="line" aria-label={t("workspace.numberViews")}>
          <TabsTrigger value="numbers">
            {t("workspace.yourNumbers")}
          </TabsTrigger>
          <TabsTrigger value="catalog">{t("workspace.catalog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="numbers" className="pt-4">
          <NumbersTable />
        </TabsContent>

        <TabsContent value="catalog" className="pt-4">
          <CatalogView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
