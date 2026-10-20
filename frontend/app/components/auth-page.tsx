import { LanguageMenu } from "@/components/language";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { AuthForm } from "@/features/auth/auth-form";
import type { AuthMode } from "@/features/auth/use-auth-form";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const register = mode === "register";
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-1">
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-10 sm:px-8 md:grid-cols-2 md:gap-20 md:py-16"
      >
        <section className="hidden max-w-md self-center md:block">
          <p className="mb-5 text-xs font-medium text-muted-foreground">
            {t("auth.authorizedCommunicationWorkspace")}
          </p>
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t("auth.accountAndOrganizationAccessInOnePlace")}
          </h2>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
            {t("auth.numdockStartsWithASecureIdentityLayer")}
          </p>
          <div className="mt-10 hidden space-y-6 border-t border-border pt-8 md:block">
            <Feature
              icon={Building2}
              title={t("auth.organizationScopedAccess")}
              text={t("auth.keepAccountAndResourceAccessWithinYour")}
            />
            <Feature
              icon={ShieldCheck}
              title={t("auth.secureBrowserSessions")}
              text={t("auth.httponlyCookiesCsrfChecksAndA12")}
            />
            <Feature
              icon={UserRound}
              title={t("auth.authorizedUseByDesign")}
              text={t("auth.builtForCommunicationServicesYouHavePermission")}
            />
          </div>
        </section>
        <section
          aria-labelledby="auth-title"
          className="w-full max-w-md rounded-lg border border-border bg-surface p-6 sm:p-8 md:justify-self-end"
        >
          <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">
            {register ? t("auth.createYourWorkspace") : t("auth.welcomeBack")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {register
              ? t("auth.startWithYourAccountAndOrganization")
              : t("auth.signInToContinueToYourWorkspace")}
          </p>
          <AuthForm mode={mode} />
          <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            {register ? t("auth.alreadyHaveAnAccount") : t("auth.newToNumdock")}{" "}
            <Link
              to={register ? "/login" : "/register"}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {register ? t("auth.signIn") : t("auth.createAWorkspace")}
            </Link>
          </p>
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            {t("auth.thisBuildIncludesIdentityAndOrganizationAccess")}
          </p>
        </section>
      </main>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border px-5 py-5 text-xs text-muted-foreground sm:px-8">
        <span>{t("auth.numdockCommunicationResources")}</span>
        <span>{t("auth.authorizedAccessOnly")}</span>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Building2;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3.5">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
