import { LoaderCircle } from "lucide-react";
import { AccountMenu } from "@/features/auth/account-menu";
import { useSession, useIdentity } from "@/hooks/api/auth";
import { errorMessage } from "@/lib/api/client";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Brand } from "@/components/brand";
import { LanguageMenu } from "@/components/language";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { ThemeToggle } from "@/components/theme";

export function PublicHeader() {
  const { t } = useTranslation();
  const { identity, logout } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-16 w-full items-center justify-between gap-2 px-5 sm:gap-6 sm:px-8 lg:px-12">
        <Brand />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          <Link
            to="/#numbers"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.numbersAndPricing")}
          </Link>
          <Link
            to="/security"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.navSecurity")}
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <Link
            to="/#numbers"
            className="hidden min-h-11 items-center px-2 text-sm font-medium text-primary min-[360px]:inline-flex lg:hidden"
          >
            {t("workspace.catalog")}
          </Link>
          {identity.data ? (
            <>
              <Link
                to="/app"
                className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-primary hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex"
              >
                {t("home.openWorkspace")}
              </Link>
              <AccountMenu
                identity={identity.data}
                signingOut={logout.isPending}
                onSignOut={() => logout.mutate()}
              />
            </>
          ) : identity.data === null ? (
            <>
              <Link
                to="/login"
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("home.secondaryCta")}
              </Link>
              <ButtonLink
                href="/register"
                size="sm"
                className="hidden rounded-md sm:inline-flex"
              >
                {t("home.primaryCta")}
              </ButtonLink>
            </>
          ) : identity.isPending ? (
            <span
              role="status"
              className="flex size-9 items-center justify-center text-muted-foreground"
            >
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span className="sr-only">{t("auth.checkingSession")}</span>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              title={errorMessage(identity.error, t)}
              onClick={() => void identity.refetch()}
            >
              {t("auth.retrySession")}
            </Button>
          )}
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
      {logout.isError ? (
        <p
          role="alert"
          className="border-t border-border px-5 py-2 text-sm text-destructive"
        >
          {errorMessage(logout.error, t)}
        </p>
      ) : null}
    </header>
  );
}

export function PublicFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="flex w-full flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>{t("home.footerTagline")}</span>
          <Link
            to="/security"
            className="hover:text-foreground hover:underline"
          >
            {t("home.navSecurity")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

// Public calls to action share the same session cache as the navigation.
export function WorkspaceEntry({ className }: { className?: string }) {
  const { t } = useTranslation();
  const identity = useIdentity();
  return (
    <ButtonLink
      href={identity.data === null ? "/register" : "/app"}
      className={className ?? "rounded-md"}
    >
      {t(identity.data === null ? "home.primaryCta" : "home.openWorkspace")}
    </ButtonLink>
  );
}
