import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/motion/button/base";
import { ThemeToggle } from "@/components/theme";
import { LanguageMenu } from "@/components/language";

export function ErrorPage({ missing = false }: { missing?: boolean }) {
  const { t } = useTranslation();
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
        className="flex flex-1 items-center justify-center p-6"
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
          <div className="flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {missing ? "404" : t("common.unexpectedError")}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {missing
              ? t("common.pageNotFound")
              : t("common.somethingWentWrong")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {missing
              ? t("common.thePageYouRequestedDoesNotExist")
              : t("common.thePageCouldNotBeRenderedReload")}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t("common.reload")}
            </Button>
            <Link
              to="/app"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {t("common.backToWorkspace")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
