import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, NavLink, useNavigate } from "react-router";
import { ArrowUpRight, Building2, LayoutDashboard, LoaderCircle, LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { api, ApiError, csrfHeaders, errorMessage, identityQuery } from "@/lib/api/client";

export const meta = () => [{ title: "Workspace · NumDock" }];

export default function Workspace() {
  const identity = useQuery(identityQuery);
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: async () => {
      const result = await api.POST("/v1/auth/logout", { params: { header: await csrfHeaders() } });
      if (!result.response.ok && result.response.status !== 401) throw new ApiError(result.response.status, result.error?.code ?? "request_failed", result.error?.message ?? "Could not sign out. Please try again.");
    },
    onSuccess: () => { client.clear(); void navigate("/login", { replace: true }); },
  });

  if (identity.error instanceof ApiError && identity.error.status === 401) return <Navigate to="/login" replace />;

  const data = identity.data;
  return <div className="flex min-h-svh flex-col">
    <header className="flex h-18 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5 sm:px-8"><Brand /><div className="flex items-center gap-2"><ThemeToggle /><Button variant="outline" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut className="size-4" aria-hidden="true" />{logout.isPending ? "Signing out…" : "Sign out"}</Button></div></header>
    <div className="flex flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border p-5 md:flex">
        <p className="px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Workspace</p>
        <div className="my-4 flex items-center gap-3 px-3"><Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="truncate text-sm font-medium">{data?.organizations[0]?.name ?? "Your organization"}</span></div>
        <nav aria-label="Workspace"><NavLink to="/app" end className="flex items-center gap-3 rounded-md bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground"><LayoutDashboard className="size-4" aria-hidden="true" />Overview</NavLink></nav>
        {data && <div className="mt-auto border-t border-border px-3 pt-5"><p className="truncate text-sm font-medium">{data.user.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{data.user.email}</p></div>}
      </aside>
      <main id="main-content" className="min-w-0 flex-1 p-6 sm:p-10 lg:p-12">
        <div className="mx-auto max-w-4xl">
          <p className="mb-7 text-xs text-muted-foreground">Workspace <span className="mx-2" aria-hidden="true">/</span> Overview</p>
          {identity.isPending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading your workspace…</p>}
          {identity.isError && <div role="alert"><h1 className="text-xl font-semibold">Unable to load workspace</h1><p className="mt-3 text-sm text-muted-foreground">{errorMessage(identity.error)}</p><Button variant="outline" className="mt-5" onClick={() => void identity.refetch()}>Try again</Button></div>}
          {logout.isError && <p role="alert" className="mb-6 text-sm text-destructive">{errorMessage(logout.error)}</p>}
          {data && <>
            <div className="border-b border-border pb-8"><p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">Organization workspace</p><h1 className="break-words text-3xl font-semibold tracking-tight">{data.organizations[0]?.name ?? "Your workspace"}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your account and organization access, in one place.</p></div>
            <section aria-labelledby="organizations-title" className="py-8">
              <div className="mb-5 flex items-baseline justify-between gap-3"><h2 id="organizations-title" className="text-base font-semibold">Your organizations</h2><span className="text-xs text-muted-foreground">{data.organizations.length} {data.organizations.length === 1 ? "workspace" : "workspaces"}</span></div>
              {data.organizations.length === 0 ? <p className="rounded-md border border-border bg-surface p-5 text-sm text-muted-foreground">You do not belong to an organization yet. Contact your workspace administrator.</p> : <div className="overflow-x-auto rounded-lg border border-border bg-surface"><table className="w-full text-left text-sm"><caption className="sr-only">Organizations you have access to</caption><thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th scope="col" className="px-5 py-3 font-medium">Organization</th><th scope="col" className="px-5 py-3 font-medium">Your role</th></tr></thead><tbody>{data.organizations.map(org => <tr key={org.id} className="border-b border-border last:border-0"><td className="max-w-64 break-words px-5 py-5"><span className="flex items-center gap-3"><Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{org.name}</span></td><td className="px-5 py-5"><span className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium capitalize text-accent-foreground">{org.role}</span></td></tr>)}</tbody></table></div>}
            </section>
            <section aria-labelledby="account-title" className="border-t border-border py-8"><h2 id="account-title" className="text-base font-semibold">Account details</h2><dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Full name</dt><dd className="mt-2 break-words">{data.user.name}</dd></div><div><dt className="text-xs text-muted-foreground">Email address</dt><dd className="mt-2 break-all">{data.user.email}</dd></div></dl></section>
            <div className="flex items-start gap-3 border-t border-border pt-6 text-sm leading-6 text-muted-foreground"><ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>Number provisioning, messaging and billing will appear here as those services become available.</p></div>
          </>}
        </div>
      </main>
    </div>
  </div>;
}
