import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import type { AnyApiReferenceConfiguration } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { Brand } from "@/components/brand";
import { LanguageMenu } from "@/components/language";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { ThemeToggle } from "@/components/theme";
import { localizedMeta } from "@/lib/i18n/meta";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

type ApiReferenceComponent = ComponentType<{
  configuration: AnyApiReferenceConfiguration;
}>;

type CSRFState = "loading" | "ready" | "error";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "docs.apiReference", "docs.apiDescription");

export default function ApiDocsRoute() {
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();
  const csrfRef = useRef("");
  const [csrfState, setCSRFState] = useState<CSRFState>("loading");
  const [Reference, setReference] = useState<ApiReferenceComponent | null>(null);
  const [referenceFailed, setReferenceFailed] = useState(false);

  const loadCSRF = useCallback(async () => {
    setCSRFState("loading");
    try {
      const response = await fetch("/v1/auth/csrf", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("csrf request failed");
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        !("token" in payload) ||
        typeof payload.token !== "string"
      ) {
        throw new Error("invalid csrf response");
      }
      csrfRef.current = payload.token;
      setCSRFState("ready");
    } catch {
      csrfRef.current = "";
      setCSRFState("error");
    }
  }, []);

  const customFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(
        input instanceof Request ? input.headers : undefined,
      );
      new Headers(init?.headers).forEach((value, key) => {
        headers.set(key, value);
      });
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      if (csrfRef.current && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        headers.set("X-CSRF-Token", csrfRef.current);
      }
      return fetch(input, {
        ...init,
        credentials: "include",
        headers,
      });
    },
    [],
  );

  useEffect(() => {
    void loadCSRF();
  }, [loadCSRF]);

  useEffect(() => {
    let active = true;
    void import("@scalar/api-reference-react")
      .then(({ ApiReferenceReact }) => {
        if (active) setReference(() => ApiReferenceReact);
      })
      .catch(() => {
        if (active) setReferenceFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en";
  const configuration = useMemo<AnyApiReferenceConfiguration>(
    () => ({
      url: "/v1/openapi.yaml",
      theme: "none",
      telemetry: false,
      withDefaultFonts: false,
      forceDarkModeState: resolvedTheme,
      hideDarkModeToggle: true,
      hideTestRequestButton: false,
      defaultRequestBodyView: "form",
      documentDownloadType: "yaml",
      showOperationId: false,
      localization: { locale },
      customFetch,
    }),
    [customFetch, locale, resolvedTheme],
  );

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Brand />
          <span className="hidden text-xs font-medium tracking-wide text-muted-foreground sm:inline">
            {t("docs.apiReference")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "hidden text-xs sm:inline",
              csrfState === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
            role="status"
          >
            {csrfState === "ready"
              ? t("docs.csrfReady")
              : csrfState === "error"
                ? t("docs.csrfUnavailable")
                : null}
          </span>
          {csrfState === "error" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCSRF()}
            >
              {t("docs.refreshCsrf")}
            </Button>
          ) : null}
          <ButtonLink
            href="/app"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {t("common.backToWorkspace")}
          </ButtonLink>
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground sm:px-6">
        {t("docs.testRequestsHint")}
      </div>

      <main
        id="main-content"
        className="api-docs-surface min-h-0 flex-1"
      >
        {referenceFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("common.somethingWentWrong")}
            </p>
            <Button variant="outline" size="sm" onClick={() => location.reload()}>
              {t("common.reload")}
            </Button>
          </div>
        ) : Reference ? (
          <Reference configuration={configuration} />
        ) : (
          <div
            className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t("docs.loadingReference")}
          </div>
        )}
      </main>
    </div>
  );
}
