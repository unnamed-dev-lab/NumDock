import { OperationsProvider } from "@/features/operations/runtime";
import type { MetaFunction, ShouldRevalidateFunction } from "react-router";
import type { Route } from "./+types/workspace";
import { localizedMeta } from "@/lib/i18n/meta";
import { LanguageMenu } from "@/components/language";
import { useTranslation } from "react-i18next";
import {
  Navigate,
  Outlet,
  redirect,
  useLoaderData,
  useRouteError,
} from "react-router";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/motion/button/base";
import { ThemeToggle } from "@/components/theme";
import { WorkspaceRouteError } from "@/components/workspace-route-error";
import { WorkspaceShell } from "@/features/workspace/workspace-shell";
import { useSession } from "@/hooks/api/auth";
import { fetchServerIdentity } from "@/lib/api/server";
import { ApiError, errorMessage, type Identity } from "@/lib/api/client";

export type WorkspaceOutletContext = {
  identity: Identity;
};

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "workspace.workspace"),
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request }: Route.LoaderArgs) {
  let identity: Identity | null;
  try {
    identity = await fetchServerIdentity(request);
  } catch (error) {
    throw new Response("Unable to load the workspace.", {
      status: error instanceof ApiError && error.status === 503 ? 503 : 502,
    });
  }

  if (!identity) {
    const url = new URL(request.url);
    const target = url.pathname + url.search;
    throw redirect(
      target === "/app"
        ? "/login"
        : "/login?returnTo=" + encodeURIComponent(target),
    );
  }

  const url = new URL(request.url);
  const selected = url.searchParams.get("organization");
  if (selected) {
    const organization = identity.organizations.find(
      (o) => o.slug === selected || o.id === selected,
    );
    if (!organization)
      throw new Response("Workspace not found.", { status: 404 });
    if (selected !== organization.slug) {
      url.searchParams.set("organization", organization.slug);
      throw redirect(url.pathname + url.search);
    }
  }
  return identity;
}

// Search params below /app belong to TanStack Query: tabs, filters, pagination
// and payment references must not re-run the identity loader on every change.
// Organization changes still need server-side membership validation.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  if (
    currentUrl.searchParams.get("organization") !==
    nextUrl.searchParams.get("organization")
  )
    return defaultShouldRevalidate;
  if (currentUrl.href === nextUrl.href) return defaultShouldRevalidate;
  return false;
};

function WorkspaceLoading() {
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
        role="status"
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {t("workspace.loadingYourWorkspace")}
        </p>
      </main>
    </div>
  );
}

function WorkspaceLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
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
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            {t("workspace.unableToLoadWorkspace")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {message}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t("workspace.tryAgain")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Workspace() {
  const { t } = useTranslation();
  const loaderIdentity = useLoaderData<typeof loader>();
  const { identity, logout } = useSession(loaderIdentity);

  if (identity.isPending) return <WorkspaceLoading />;

  if (identity.data === null) {
    return <Navigate to="/login" replace />;
  }

  if (identity.isError || !identity.data) {
    return (
      <WorkspaceLoadError
        message={errorMessage(identity.error, t)}
        onRetry={() => void identity.refetch()}
      />
    );
  }

  return (
    <OperationsProvider identity={identity.data}>
      <WorkspaceShell
        identity={identity.data}
        signingOut={logout.isPending}
        onSignOut={() => logout.mutate()}
      >
        {logout.isError ? (
          <p
            role="alert"
            className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {errorMessage(logout.error, t)}
          </p>
        ) : null}
        <Outlet
          context={{ identity: identity.data } satisfies WorkspaceOutletContext}
        />
      </WorkspaceShell>
    </OperationsProvider>
  );
}

export function ErrorBoundary() {
  const { t } = useTranslation();
  const error = useRouteError();
  return (
    <WorkspaceRouteError
      error={error}
      title={t("workspace.workspaceUnavailable")}
    />
  );
}
