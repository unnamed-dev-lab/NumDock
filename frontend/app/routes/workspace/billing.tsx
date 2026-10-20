import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { CreditCard, ReceiptText, Wallet } from "lucide-react";
import {
  EmptyState,
  InlineNote,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "@/features/workspace/workspace-ui";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.billing");

const plannedControls = [
  {
    icon: Wallet,
    title: "workspace.prepaidBalance",
    description: "workspace.aSingleBalancePerOrganizationWithCurrencies",
  },
  {
    icon: ReceiptText,
    title: "workspace.immutableLedger",
    description: "workspace.everyChargeRefundAndAdjustmentIsAn",
  },
  {
    icon: CreditCard,
    title: "workspace.paymentControls",
    description: "workspace.topUpsAutoRechargeThresholdsAndPayment",
  },
] as const;

export default function BillingRoute() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.account")}
        title={t("workspace.billing")}
        description={t(
          "workspace.prepaidBalancePaymentMethodsAndTheOrganization",
        )}
        status={
          <StatusBadge tone="neutral">{t("workspace.notEnabled")}</StatusBadge>
        }
      />

      <EmptyState
        icon={Wallet}
        title={t("workspace.noBillingData")}
        description={t("workspace.billingIsNotEnabledInThisBuild")}
      />

      <section className="space-y-3" aria-labelledby="billing-planned-title">
        <SectionHeading
          id="billing-planned-title"
          title={t("workspace.plannedControls")}
          description={t("workspace.theseSurfacesWillBeEnabledWithThe")}
        />
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {plannedControls.map((control) => {
              const Icon = control.icon;
              return (
                <li
                  key={control.title}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 sm:flex sm:items-baseline sm:gap-4">
                    <h3 className="w-40 shrink-0 text-sm font-medium text-foreground">
                      {t(control.title)}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t(control.description)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <InlineNote icon={ReceiptText}>
        {t("workspace.numdockDoesNotDisplayDemoBalancesOr")}
      </InlineNote>
    </div>
  );
}
