import { useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, themeScript } from "@/components/theme";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex, nofollow" />
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <Meta /><Links />
    </head>
    <body><a href="#main-content" className="sr-only z-50 rounded-md bg-surface p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>{children}<ScrollRestoration /><Scripts /></body>
  </html>;
}

export default function App() {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><ThemeProvider><Outlet /></ThemeProvider></QueryClientProvider>;
}

export function HydrateFallback() { return <main id="main-content" className="p-8 text-sm text-muted-foreground" role="status">Loading NumDock…</main>; }

export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return <main id="main-content" className="mx-auto max-w-lg px-6 py-24">
    <h1 className="text-2xl font-semibold">{missing ? "Page not found" : "Something went wrong"}</h1>
    <p className="mt-3 text-muted-foreground">{missing ? "This page does not exist." : "Please reload the page and try again."}</p>
    <a href="/" className="mt-6 inline-block text-primary underline underline-offset-4">Return to NumDock</a>
  </main>;
}
