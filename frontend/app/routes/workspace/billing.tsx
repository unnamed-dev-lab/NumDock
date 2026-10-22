import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/features/workspace/workspace-ui";
import { PaymentCheckout } from "@/features/operations/payments";
import { BillingTables } from "@/features/operations/billing";
import { WalletSummary } from "@/features/operations/billing";
export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.billing");
export default function Route() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("workspace.billing")}
        description={t("workspace.opsBillingDescription")}
      />
      <WalletSummary />
      <PaymentCheckout />
      <BillingTables />
    </div>
  );
}
