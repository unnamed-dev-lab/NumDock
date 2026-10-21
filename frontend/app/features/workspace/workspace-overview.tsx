import { useOperations } from "@/features/operations/runtime";
import { OverviewDashboard } from "./overview-dashboard";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import {
  InlineNote,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "./workspace-ui";

export function WorkspaceOverview({ identity }: { identity: Identity }) {
  const { t, i18n } = useTranslation();
  const { organizations } = identity;
  const { organization } = useOperations();
  return (
    <div className="space-y-8">
      <PageHeader
        title={organization?.name ?? t("workspace.yourWorkspace")}
        description={t("workspace.overviewDescription")}
      />
      <OverviewDashboard identity={identity} />
      <section className="space-y-3" aria-labelledby="organizations-title">
        <SectionHeading
          id="organizations-title"
          title={t("workspace.yourOrganizations")}
          description={t("workspace.membershipsReturnedByTheIdentityService")}
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
                        <span className="break-words">{organization.name}</span>
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
    </div>
  );
}
