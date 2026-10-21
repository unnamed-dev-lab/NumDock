import type { MetaFunction } from "react-router";
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
import { useWorkspace } from "@/features/workspace/use-workspace";
import { ApiError, errorMessage, type Identity } from "@/lib/api/client";

export type WorkspaceOutletContext = {
  identity: Identity;
};

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "workspace.workspace"),
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const baseURL = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080";
  let response: Response;
  try {
    response = await fetch(`${baseURL}/v1/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
  } catch {
    throw new Response("Unable to reach the identity service.", {
      status: 502,
    });
  }

  if (response.status === 401) throw redirect("/login");
  if (!response.ok) {
    throw new Response("Unable to load the workspace.", {
      status: response.status === 503 ? 503 : 502,
    });
  }

  return (await response.json()) as Identity;
}

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
  const { identity, logout } = useWorkspace(loaderIdentity);

  if (identity.isPending) return <WorkspaceLoading />;

  if (identity.error instanceof ApiError && identity.error.status === 401) {
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
