import { ModeNotice } from "@/features/operations/shared";
import { StatusBadge } from "./workspace-ui";
import { AccountMenu } from "@/features/auth/account-menu";
import { useOperations } from "@/features/operations/runtime";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  BookOpen,
  Building2,
  ChevronRight,
  Globe2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  PanelLeft,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar";
import type { TranslationKey } from "@/lib/i18n";
import { roleLabel } from "@/lib/i18n/labels";
import { LanguageMenu } from "@/components/language";
import type { Identity } from "@/lib/api/client";
import { cn, initials } from "@/lib/utils";

type NavigationItem = {
  label: TranslationKey;
  to: string;
  icon: LucideIcon;
};

const primaryNavigation: NavigationItem[] = [
  { label: "workspace.overview", to: "/app", icon: LayoutDashboard },
  {
    label: "workspace.numbers",
    to: "/app/numbers",
    icon: Globe2,
  },
  {
    label: "workspace.messages",
    to: "/app/messages",
    icon: Inbox,
  },
  {
    label: "workspace.billing",
    to: "/app/billing",
    icon: Wallet,
  },
];

const developerNavigation: NavigationItem[] = [
  {
    label: "workspace.apiWebhooks",
    to: "/app/developers",
    icon: KeyRound,
  },
  {
    label: "workspace.apiReference",
    to: "/docs/api",
    icon: BookOpen,
  },
];

const accountNavigation: NavigationItem[] = [
  { label: "workspace.settings", to: "/app/settings", icon: Settings },
];

const sectionTitles: Record<string, TranslationKey> = {
  "/app": "workspace.overview",
  "/app/numbers": "workspace.numbers",
  "/app/messages": "workspace.messages",
  "/app/billing": "workspace.billing",
  "/app/developers": "workspace.apiWebhooks",
  "/app/settings": "workspace.settings",
};

function isCurrent(pathname: string, target: string) {
  if (target === "/app") return pathname === "/app";
  return pathname === target || pathname.startsWith(`${target}/`);
}

function NavigationGroup({
  label,
  items,
}: {
  label: TranslationKey;
  items: NavigationItem[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { organization } = useOperations();

  return (
    <AnimatedSidebarGroup>
      <AnimatedSidebarGroupLabel>{t(label)}</AnimatedSidebarGroupLabel>
      <nav aria-label={t(label)}>
        <AnimatedSidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(pathname, item.to);
            return (
              <AnimatedSidebarMenuItem key={item.to}>
                <AnimatedSidebarMenuButton
                  className="min-h-11 md:min-h-9"
                  icon={<Icon className="size-4" />}
                  isActive={active}
                  onSelect={() =>
                    void navigate(
                      organization
                        ? `${item.to}?organization=${encodeURIComponent(organization.id)}`
                        : item.to,
                    )
                  }
                >
                  {t(item.label)}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            );
          })}
        </AnimatedSidebarMenu>
      </nav>
    </AnimatedSidebarGroup>
  );
}

export function WorkspaceShell({
  identity,
  signingOut,
  onSignOut,
  children,
}: {
  identity: Identity;
  signingOut: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { organization, summary } = useOperations();
  const [params, setParams] = useSearchParams();
  const currentTitle = sectionTitles[pathname] ?? "workspace.workspace";

  return (
    <AnimatedSidebarProvider
      className="flex h-svh w-full overflow-hidden bg-background"
      style={{ "--sidebar-width": "16rem" }}
    >
      <AnimatedSidebar
        ariaLabel={t("workspace.workspaceNavigation")}
        collapsible="icon"
        className="bg-surface"
        panelClassName="border-r border-border bg-surface"
      >
        <AnimatedSidebarHeader className="gap-4 p-4 group-data-[state=collapsed]/sidebar:px-3">
          <div className="flex items-center justify-between gap-2 group-data-[state=collapsed]/sidebar:justify-center">
            <AnimatedSidebarClose
              aria-label={t("common.closeSidebar")}
              className="order-last size-11 md:hidden"
            >
              <X className="size-4" aria-hidden="true" />
            </AnimatedSidebarClose>
            <Brand nameClassName="group-data-[state=collapsed]/sidebar:hidden" />
          </div>

          <div
            title={organization?.name ?? t("workspace.noOrganization")}
            className="hidden h-11 items-center justify-center rounded-md border border-border bg-background text-primary group-data-[state=collapsed]/sidebar:flex"
          >
            <Building2
              className="size-4"
              role="img"
              aria-label={organization?.name ?? t("workspace.noOrganization")}
            />
          </div>
          <div className="rounded-md border border-border bg-background p-3 group-data-[state=collapsed]/sidebar:hidden">
            <p className="text-xs font-medium text-muted-foreground">
              {t("workspace.organization")}
            </p>
            {identity.organizations.length > 1 ? (
              <Select
                value={organization?.id ?? ""}
                onValueChange={(value) => {
                  if (value) {
                    const next = new URLSearchParams(params);
                    next.set("organization", value);
                    for (const key of [...next.keys()]) {
                      if (key.endsWith("Offset")) next.delete(key);
                    }
                    setParams(next, { preventScrollReset: true });
                  }
                }}
                items={identity.organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                }))}
              >
                <SelectTrigger
                  aria-label={t("workspace.organization")}
                  className="mt-2 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {identity.organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                <Building2
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-foreground">
                  {organization?.name ?? t("workspace.noOrganization")}
                </span>
              </div>
            )}
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {organization?.role
                ? roleLabel(organization.role, t)
                : t("workspace.noRole")}
              {identity.organizations.length > 1
                ? ` · ${t("common.workspaceCount", { count: identity.organizations.length })}`
                : ""}
            </p>
          </div>
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent className="gap-1 px-2 py-1">
          <NavigationGroup
            label="workspace.workspace"
            items={primaryNavigation}
          />
          <NavigationGroup
            label="workspace.developer"
            items={developerNavigation}
          />
          <NavigationGroup
            label="workspace.account"
            items={accountNavigation}
          />
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter className="gap-3">
          <div
            className="flex min-w-0 items-center gap-2.5 px-1 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0"
            title={identity.user.name}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground">
              {initials(identity.user.name)}
            </span>
            <div className="min-w-0 group-data-[state=collapsed]/sidebar:hidden">
              <p className="truncate text-sm font-medium text-foreground">
                {identity.user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {identity.user.email}
              </p>
            </div>
          </div>
        </AnimatedSidebarFooter>
      </AnimatedSidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <AnimatedSidebarTrigger
              aria-label={t("common.toggleSidebar")}
              className="size-11 hover:bg-muted/60 md:size-9"
            >
              <PanelLeft className="size-4" aria-hidden="true" />
            </AnimatedSidebarTrigger>
            <nav
              aria-label={t("workspace.breadcrumb")}
              className="hidden min-w-0 items-center gap-1.5 text-sm md:flex"
            >
              <Link
                to="/app"
                className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("workspace.workspace")}
              </Link>
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span
                aria-current="page"
                className="truncate font-medium text-foreground"
              >
                {t(currentTitle)}
              </span>
            </nav>
            {summary?.mode === "mock" ? (
              <span title={t("workspace.environmentDetails")}>
                <StatusBadge>
                  {t("workspace.developmentEnvironment")}
                </StatusBadge>
              </span>
            ) : null}
            <span className="truncate text-sm font-medium text-foreground md:hidden">
              {t(currentTitle)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <LanguageMenu />
            <ThemeToggle />
            <AccountMenu
              identity={identity}
              signingOut={signingOut}
              onSignOut={onSignOut}
            />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto",
            "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
          )}
        >
          <div className="mx-auto w-full max-w-6xl p-5 sm:p-8 lg:p-10">
            <ModeNotice />
            {children}
          </div>
        </main>
      </div>
    </AnimatedSidebarProvider>
  );
}
