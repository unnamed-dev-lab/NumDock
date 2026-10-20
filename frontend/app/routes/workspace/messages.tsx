import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { Inbox, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  EmptyState,
  InlineNote,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "@/features/workspace/workspace-ui";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.messages");

const accessRules = [
  {
    title: "workspace.leaseBound",
    description: "workspace.aMessageCanOnlyBeReadThrough",
  },
  {
    title: "workspace.tenantScoped",
    description: "workspace.everyReadIsAuthorizedServerSideAgainst",
  },
  {
    title: "workspace.noSharedInbox",
    description: "workspace.messagesAreNeverPooledAcrossCustomersOr",
  },
] as const;

export default function MessagesRoute() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.telephony")}
        title={t("workspace.messages")}
        description={t("workspace.inboundSmsTiedToYourOrganizationS")}
        status={
          <StatusBadge tone="neutral">
            {t("workspace.notConnected")}
          </StatusBadge>
        }
      />

      <EmptyState
        icon={Inbox}
        title={t("workspace.noInboundMessages")}
        description={t("workspace.thereAreNoActiveNumberLeasesSo")}
      />

      <section className="space-y-3" aria-labelledby="message-access-title">
        <SectionHeading
          id="message-access-title"
          title={t("workspace.messageAccessRules")}
          description={t("workspace.theseConstraintsApplyToTheFirstMessaging")}
        />
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border">
            {accessRules.map((rule) => (
              <li
                key={rule.title}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
              >
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="min-w-0 sm:flex sm:items-baseline sm:gap-4">
                  <h3 className="w-40 shrink-0 text-sm font-medium text-foreground">
                    {t(rule.title)}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(rule.description)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <InlineNote icon={LockKeyhole}>
        {t("workspace.verificationCodesAreSensitiveNumdockDoesNot")}
      </InlineNote>
    </div>
  );
}
