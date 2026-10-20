import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { KeyRound, LockKeyhole, ShieldCheck, Webhook } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  InlineNote,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "@/features/workspace/workspace-ui";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.apiWebhooks");

const scopes = [
  ["numbers:read", "workspace.readNumbersAndLeaseStatus"],
  ["numbers:order", "workspace.requestANumberLease"],
  ["numbers:release", "workspace.releaseALease"],
  ["sms:inbox", "workspace.readMessagesForAnAuthorizedLease"],
  ["webhooks:manage", "workspace.manageWebhookEndpoints"],
  ["billing:read", "workspace.readBalanceAndLedgerEntries"],
] as const;

export default function DevelopersRoute() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.developer")}
        title={t("workspace.apiWebhooks")}
        description={t("workspace.scopedBearerTokensAndSignedWebhookDelivery")}
        status={
          <StatusBadge tone="neutral">{t("workspace.planned")}</StatusBadge>
        }
      />

      <Tabs defaultValue="keys" className="flex-col gap-4">
        <TabsList variant="line" aria-label={t("workspace.developerResources")}>
          <TabsTrigger value="keys">{t("workspace.apiKeys")}</TabsTrigger>
          <TabsTrigger value="webhooks">{t("workspace.webhooks")}</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="pt-5">
          <EmptyState
            icon={KeyRound}
            title={t("workspace.apiAccessIsNotEnabled")}
            description={t("workspace.thereAreNoApiKeysToDisplay")}
          >
            <div className="space-y-3">
              <SectionHeading title={t("workspace.plannedScopes")} />
              <div className="overflow-hidden rounded-md border border-border">
                <dl className="divide-y divide-border">
                  {scopes.map(([scope, description]) => (
                    <div
                      key={scope}
                      className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                    >
                      <dt className="font-mono text-xs text-foreground">
                        {scope}
                      </dt>
                      <dd className="text-sm text-muted-foreground sm:text-right">
                        {t(description)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </EmptyState>
        </TabsContent>

        <TabsContent value="webhooks" className="pt-5">
          <EmptyState
            icon={Webhook}
            title={t("workspace.noWebhookEndpoints")}
            description={t("workspace.webhookConfigurationIsNotEnabledInThis")}
          />
        </TabsContent>
      </Tabs>

      <InlineNote icon={LockKeyhole}>
        {t("workspace.thePlannedApiStoresOnlyAHash")}
      </InlineNote>

      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t("workspace.mockKeysAndFakeWebhookSecretsAre")}
      </p>
    </div>
  );
}
