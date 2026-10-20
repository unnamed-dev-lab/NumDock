import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  data,
  useRouteLoaderData,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, themeScript } from "@/components/theme";
import { ErrorPage } from "@/components/error-page";
import { LocaleProvider } from "@/lib/i18n";
import { defaultLocale, resolveLocale } from "@/lib/i18n/locale";
import type { Route } from "./+types/root";
import "./app.css";

export function loader({ request }: Route.LoaderArgs) {
  const locale = resolveLocale(request);
  return data(
    { locale },
    {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie, Accept-Language",
        "Content-Language": locale,
      },
    },
  );
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) =>
  loaderHeaders;

export function Layout({ children }: { children: React.ReactNode }) {
  const locale =
    useRouteLoaderData<typeof loader>("root")?.locale ?? defaultLocale;
  const [client] = useState(() => new QueryClient());
  return (
    <LocaleProvider locale={locale}>
      <html lang={locale} suppressHydrationWarning>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <Meta />
          <Links />
        </head>
        <body>
          <QueryClientProvider client={client}>
            <ThemeProvider>
              <SkipLink />
              {children}
              <ScrollRestoration />
              <Scripts />
            </ThemeProvider>
          </QueryClientProvider>
        </body>
      </html>
    </LocaleProvider>
  );
}

function SkipLink() {
  const { t } = useTranslation();
  return (
    <a
      href="#main-content"
      className="sr-only z-50 rounded-md bg-surface p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      {t("common.skipToContent")}
    </a>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  const { t } = useTranslation();
  return (
    <main
      id="main-content"
      className="p-8 text-sm text-muted-foreground"
      role="status"
    >
      {t("common.loadingNumdock")}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <ErrorPage missing={isRouteErrorResponse(error) && error.status === 404} />
  );
}
