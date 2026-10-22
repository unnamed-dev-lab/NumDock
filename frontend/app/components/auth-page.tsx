import { workspaceReturnTo } from "@/features/auth/return-to";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Brand } from "@/components/brand";
import { LanguageMenu } from "@/components/language";
import { ThemeToggle } from "@/components/theme";
import { AuthForm } from "@/features/auth/auth-form";
import type { AuthMode } from "@/features/auth/use-auth-form";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const register = mode === "register";
  const [params] = useSearchParams();
  const target = workspaceReturnTo(params.get("returnTo"));
  const query =
    target === "/app" ? "" : "?returnTo=" + encodeURIComponent(target);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-1">
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8"
      >
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {register ? t("auth.createYourWorkspace") : t("auth.welcomeBack")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {register
                ? t("auth.startWithYourAccountAndOrganization")
                : t("auth.signInToContinueToYourWorkspace")}
            </p>
          </div>

          <section
            aria-labelledby="auth-title"
            className="rounded-lg border border-border bg-surface p-6 shadow-xs sm:p-8"
          >
            <h2 id="auth-title" className="sr-only">
              {register ? t("auth.createYourWorkspace") : t("auth.welcomeBack")}
            </h2>
            <AuthForm mode={mode} />
            <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
              {register
                ? t("auth.alreadyHaveAnAccount")
                : t("auth.newToNumdock")}{" "}
              <Link
                to={(register ? "/login" : "/register") + query}
                className="rounded-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {register ? t("auth.signIn") : t("auth.createAWorkspace")}
              </Link>
            </p>
          </section>

          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {t("auth.backHome")}
            </Link>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("auth.thisBuildIncludesIdentityAndOrganizationAccess")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
