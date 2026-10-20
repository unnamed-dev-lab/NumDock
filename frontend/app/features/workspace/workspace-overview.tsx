import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  Fingerprint,
  Globe2,
  Inbox,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/lib/i18n/labels";
import type { Identity } from "@/lib/api/client";
import { formatDate, initials } from "@/lib/utils";
import {
  DetailRow,
  InlineNote,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "./workspace-ui";

const services = [
  {
    name: "workspace.identityAccess",
    description:
      "workspace.accountOrganizationMembershipAndSecureBrowserSessions",
    href: "/app/settings",
    icon: Fingerprint,
    status: "workspace.active",
    tone: "active" as const,
  },
  {
    name: "workspace.numberCatalog",
    description:
      "workspace.authorizedInventoryCountryCoverageAndTransparentPricing",
    href: "/app/numbers",
    icon: Globe2,
    status: "workspace.notConnected",
    tone: "neutral" as const,
  },
  {
    name: "workspace.inboundMessaging",
    description: "workspace.leaseBoundSmsInboxWithTenantLevel",
    href: "/app/messages",
    icon: Inbox,
    status: "workspace.notConnected",
    tone: "neutral" as const,
  },
  {
    name: "workspace.billingLedger",
    description: "workspace.prepaidBalanceAndAnImmutableTransactionHistory",
    href: "/app/billing",
    icon: Wallet,
    status: "workspace.notEnabled",
    tone: "neutral" as const,
  },
] as const;

export function WorkspaceOverview({ identity }: { identity: Identity }) {
  const { t, i18n } = useTranslation();
  const { user, organizations } = identity;
  const primaryOrganization = organizations[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.workspace")}
        title={primaryOrganization?.name ?? t("workspace.yourWorkspace")}
        description={t(
          "workspace.accountAndOrganizationAccessForAuthorizedCommunication",
        )}
        status={
          <StatusBadge tone="active">
            {t("workspace.identityActive")}
          </StatusBadge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <div className="space-y-8">
          <section className="space-y-3" aria-labelledby="service-status-title">
            <SectionHeading
              id="service-status-title"
              title={t("workspace.serviceStatus")}
              description={t(
                "workspace.onlyConnectedServicesArePresentedAsOperational",
              )}
            />
            <Card className="gap-0 rounded-lg py-0 shadow-none ring-1 ring-border">
              <ul className="divide-y divide-border">
                {services.map((service) => {
                  const Icon = service.icon;
                  return (
                    <li key={service.href}>
                      <Link
                        to={service.href}
                        className="group flex items-start gap-3 px-5 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {t(service.name)}
                            </span>
                            <StatusBadge tone={service.tone}>
                              {service.tone === "active" ? (
                                <CheckCircle2
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CircleDashed
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              )}
                              {t(service.status)}
                            </StatusBadge>
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                            {t(service.description)}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>

          <section className="space-y-3" aria-labelledby="organizations-title">
            <SectionHeading
              id="organizations-title"
              title={t("workspace.yourOrganizations")}
              description={t(
                "workspace.membershipsReturnedByTheIdentityService",
              )}
              action={
                <span className="text-xs text-muted-foreground">
                  {t("common.workspaceCount", { count: organizations.length })}
                </span>
              }
            />
            {organizations.length === 0 ? (
              <InlineNote icon={Building2}>
                {t("workspace.youDoNotBelongToAnOrganization")}
              </InlineNote>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <Table>
                  <TableCaption className="sr-only">
                    {t("workspace.organizationsYouHaveAccessTo")}
                  </TableCaption>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="px-5 text-xs">
                        {t("workspace.organization")}
                      </TableHead>
                      <TableHead className="px-5 text-xs">
                        {t("workspace.yourRole")}
                      </TableHead>
                      <TableHead className="px-5 text-right text-xs">
                        {t("workspace.created")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((organization) => (
                      <TableRow key={organization.id}>
                        <TableCell className="px-5 py-4">
                          <span className="flex items-center gap-2.5 font-medium">
                            <Building2
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="break-words">
                              {organization.name}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge>
                            {roleLabel(organization.role, t)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right font-mono text-xs text-muted-foreground">
                          {formatDate(organization.created_at, i18n.language)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <InlineNote icon={ShieldCheck}>
            {t("workspace.thisBuildCoversIdentityAndOrganizationAccess")}
          </InlineNote>
        </div>

        <aside className="space-y-6">
          <Card className="rounded-lg shadow-none ring-1 ring-border">
            <CardHeader className="gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-sm">
                    {user.name}
                  </CardTitle>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={user.email}
                  >
                    {user.email}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow
                  label={t("workspace.role")}
                  value={
                    primaryOrganization?.role
                      ? roleLabel(primaryOrganization.role, t)
                      : "—"
                  }
                />
                <DetailRow
                  label={t("workspace.memberSince")}
                  value={formatDate(user.created_at, i18n.language)}
                />
              </dl>
              <Link
                to="/app/settings"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("workspace.manageWorkspaceSettings")}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none ring-1 ring-border">
            <CardHeader className="gap-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {t("workspace.sessionSecurity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow
                  label={t("workspace.sessionLifetime")}
                  value={t("workspace.12Hours")}
                />
                <DetailRow
                  label={t("workspace.cookie")}
                  value="HttpOnly · SameSite=Strict"
                />
                <DetailRow
                  label={t("workspace.serverStorage")}
                  value={t("workspace.tokenHashOnly")}
                />
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {t("workspace.theRawSessionTokenIsNeverStored")}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
