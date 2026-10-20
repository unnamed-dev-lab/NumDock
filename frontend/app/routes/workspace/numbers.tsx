import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { Globe2, PhoneCall, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "@/features/workspace/workspace-ui";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.numbers");

const catalogPreview = [
  "workspace.countryAndRegionCoverageReturnedByThe",
  "workspace.numberTypeAndTheCapabilitiesTheProvider",
  "workspace.transparentPricingAndLeaseTerms",
  "workspace.availabilityThatIsNeverSimulatedOrPre",
] as const;

export default function NumbersRoute() {
  const { t } = useTranslation();
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
            {t("workspace.notConnected")}
          </StatusBadge>
        }
      />

      <Tabs defaultValue="numbers" className="flex-col gap-4">
        <TabsList variant="line" aria-label={t("workspace.numberViews")}>
          <TabsTrigger value="numbers">
            {t("workspace.yourNumbers")}
          </TabsTrigger>
          <TabsTrigger value="catalog">{t("workspace.catalog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="numbers" className="pt-5">
          <EmptyState
            icon={PhoneCall}
            title={t("workspace.noNumbersYet")}
            description={t("workspace.numberProvisioningIsNotEnabledInThis")}
          />
        </TabsContent>

        <TabsContent value="catalog" className="pt-5">
          <EmptyState
            icon={Globe2}
            title={t("workspace.catalogNotConnected")}
            description={t(
              "workspace.inventoryCoverageAndPricingAreNotDisplayed",
            )}
          >
            <div className="space-y-3">
              <SectionHeading title={t("workspace.whatTheCatalogWillShow")} />
              <ul className="grid gap-2 sm:grid-cols-2">
                {catalogPreview.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-6 text-muted-foreground"
                  >
                    <ShieldCheck
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>
          </EmptyState>
        </TabsContent>
      </Tabs>

      <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
        {t("workspace.numdockDoesNotPreSeedInventoryOr")}
      </p>
    </div>
  );
}
