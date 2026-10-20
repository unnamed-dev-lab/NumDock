import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Globe2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TranslationKey } from "@/lib/i18n";
import { roleLabel } from "@/lib/i18n/labels";
import { LanguageMenu } from "@/components/language";
import type { Identity } from "@/lib/api/client";
import { cn, initials } from "@/lib/utils";

type NavigationItem = {
  label: TranslationKey;
  to: string;
  icon: LucideIcon;
  badge?: TranslationKey;
};

const primaryNavigation: NavigationItem[] = [
  { label: "workspace.overview", to: "/app", icon: LayoutDashboard },
  {
    label: "workspace.numbers",
    to: "/app/numbers",
    icon: Globe2,
    badge: "workspace.soon",
  },
  {
    label: "workspace.messages",
    to: "/app/messages",
    icon: Inbox,
    badge: "workspace.soon",
  },
  {
    label: "workspace.billing",
    to: "/app/billing",
    icon: Wallet,
    badge: "workspace.soon",
  },
];

const developerNavigation: NavigationItem[] = [
  {
    label: "workspace.apiWebhooks",
    to: "/app/developers",
    icon: KeyRound,
    badge: "workspace.soon",
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
                  icon={<Icon className="size-4" />}
                  isActive={active}
                  onSelect={() => void navigate(item.to)}
                  badge={
                    item.badge ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleDashed className="size-3" aria-hidden="true" />
                        {t(item.badge)}
                      </span>
                    ) : undefined
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

function AccountMenu({
  identity,
  signingOut,
  onSignOut,
}: {
  identity: Identity;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("workspace.accountMenu")}
        className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
          {initials(identity.user.name)}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium text-foreground sm:block">
          {identity.user.name}
        </span>
        <ChevronDown
          className="hidden size-3.5 text-muted-foreground sm:block"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-foreground">
              {identity.user.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {identity.user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate("/app/settings")}>
          <Settings className="size-4" aria-hidden="true" />
          {t("workspace.workspaceSettings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onClick={onSignOut}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? t("workspace.signingOut") : t("workspace.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const organization = identity.organizations[0];
  const currentTitle = sectionTitles[pathname] ?? "workspace.workspace";

  return (
    <AnimatedSidebarProvider
      className="flex h-svh w-full overflow-hidden bg-background"
      style={{ "--sidebar-width": "16rem" }}
    >
      <AnimatedSidebar
        ariaLabel={t("workspace.workspaceNavigation")}
        collapsible="none"
        className="bg-surface"
        panelClassName="border-r border-border bg-surface"
      >
        <AnimatedSidebarHeader className="gap-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <AnimatedSidebarClose
              aria-label={t("common.closeSidebar")}
              className="order-last md:hidden"
            >
              <X className="size-4" aria-hidden="true" />
            </AnimatedSidebarClose>
            <Brand />
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("workspace.organization")}
            </p>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <Building2
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="truncate text-sm font-medium text-foreground">
                {organization?.name ?? t("workspace.noOrganization")}
              </span>
            </div>
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
          <div className="flex min-w-0 items-center gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground">
              {initials(identity.user.name)}
            </span>
            <div className="min-w-0">
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
              className="md:hidden"
            >
              <Menu className="size-4" aria-hidden="true" />
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
            {children}
          </div>
        </main>
      </div>
    </AnimatedSidebarProvider>
  );
}
