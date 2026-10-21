import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Brand } from "@/components/brand";
import { LanguageMenu } from "@/components/language";
import { ButtonLink } from "@/components/motion/button/base";
import { ThemeToggle } from "@/components/theme";

export function PublicHeader() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-16 w-full items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link
            to="/platform"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.navProduct")}
          </Link>
          <Link
            to="/security"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.navSecurity")}
          </Link>
          <Link
            to="/status"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.navStatus")}
          </Link>
          <Link
            to="/docs/api"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.navApi")}
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("home.secondaryCta")}
            </Link>
            <ButtonLink href="/register" size="sm" className="rounded-md">
              {t("home.primaryCta")}
            </ButtonLink>
          </div>
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </div>
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
          <Link to="/status" className="hover:text-foreground hover:underline">
            {t("home.navStatus")}
          </Link>
          <Link to="/security" className="hover:text-foreground hover:underline">
            {t("home.navSecurity")}
          </Link>
          <Link to="/docs/api" className="hover:text-foreground hover:underline">
            {t("home.navApi")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
