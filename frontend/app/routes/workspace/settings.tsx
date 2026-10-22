import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";
import { Check, Laptop, Moon, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { useThemeToggle } from "@/components/motion/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DetailRow,
  PageHeader,
  StatusBadge,
} from "@/features/workspace/workspace-ui";
import type { WorkspaceOutletContext } from "@/routes/workspace";
import { useTheme } from "@/lib/theme-context";
import { formatDate } from "@/lib/utils";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.settings");

const themeOptions = [
  { value: "light", label: "common.light", icon: Sun },
  { value: "dark", label: "common.dark", icon: Moon },
  { value: "system", label: "common.system", icon: Laptop },
] as const;

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const { identity } = useOutletContext<WorkspaceOutletContext>();
  const { theme } = useTheme();
  const { change, busy } = useThemeToggle({ start: "bottom-up" });
  const { user } = identity;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("workspace.account")}
        title={t("workspace.settings")}
        description={t(
          "workspace.organizationAccessAccountDetailsSessionSecurityAnd",
        )}
        status={
          <StatusBadge tone="active">
            {t("workspace.identityActive")}
          </StatusBadge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
        <div className="space-y-6">
          <Card className="rounded-lg shadow-none ring-1 ring-border">
            <CardHeader className="gap-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserRound
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {t("workspace.account")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label={t("workspace.name")} value={user.name} />
                <DetailRow
                  label={t("workspace.email")}
                  value={<span className="break-all">{user.email}</span>}
                />
                <DetailRow
                  label={t("workspace.created")}
                  value={formatDate(user.created_at, i18n.language)}
                />
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {t("workspace.nameAndEmailChangesAreNotEnabled")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-lg shadow-none ring-1 ring-border">
            <CardHeader className="gap-1">
              <CardTitle className="text-sm">
                {t("common.appearance")}
              </CardTitle>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("workspace.yourPreferenceIsStoredInThisBrowser")}
              </p>
            </CardHeader>
            <CardContent className="gap-1.5">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <Button
                    key={option.value}
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => void change(option.value)}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="flex-1 text-left">{t(option.label)}</span>
                    {active ? (
                      <Check
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
