import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Building2, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, csrfHeaders, errorMessage, identityQuery, unwrap } from "@/lib/api/client";

function schema(register: boolean) {
  return z.object({
    email: z.email("Enter a valid email address.").max(254),
    password: z.string().refine(value => { const length = Array.from(value).length; return length >= 12 && length <= 128; }, "Use a password between 12 and 128 characters."),
    name: z.string().trim().max(100, "Use 100 characters or fewer."),
    organization_name: z.string().trim().max(100, "Use 100 characters or fewer."),
  }).superRefine((value, ctx) => {
    if (register && !value.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Enter your name." });
    if (register && !value.organization_name) ctx.addIssue({ code: "custom", path: ["organization_name"], message: "Enter a workspace name." });
  });
}

type Values = z.infer<ReturnType<typeof schema>>;

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const navigate = useNavigate();
  const client = useQueryClient();
  const current = useQuery(identityQuery);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema(register)), defaultValues: { email: "", password: "", name: "", organization_name: "" } });
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const headers = await csrfHeaders();
      if (register) return unwrap(await api.POST("/v1/auth/register", { params: { header: headers }, body: values }));
      return unwrap(await api.POST("/v1/auth/login", { params: { header: headers }, body: { email: values.email, password: values.password } }));
    },
    onSuccess: data => { client.clear(); client.setQueryData(identityQuery.queryKey, data); void navigate("/app", { replace: true }); },
  });

  useEffect(() => { if (current.data) void navigate("/app", { replace: true }); }, [current.data, navigate]);
  const rootError = form.formState.errors.root?.message;
  useEffect(() => { if (rootError) errorRef.current?.focus(); }, [rootError]);
  const submitting = form.formState.isSubmitting;
  const submit = form.handleSubmit(async values => {
    try { await mutation.mutateAsync(values); }
    catch (error) { form.setError("root", { message: errorMessage(error) }); }
  });

  return <div className="flex min-h-svh flex-col">
    <header className="flex h-20 shrink-0 items-center justify-between px-6 sm:px-10"><Brand /><ThemeToggle /></header>
    <main id="main-content" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-10 md:grid-cols-2 md:gap-20 md:py-16">
      <section className="hidden max-w-md self-center md:block">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Your communication workspace</p>
        <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">One place for your<br className="hidden sm:block" /> numbers and messages.</h2>
        <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">A dedicated workspace for your team’s authorized communication services.</p>
        <div className="mt-10 hidden space-y-6 border-t border-border pt-8 md:block">
          <Feature icon={Building2} title="An organization of your own" text="Keep access and resources within your workspace." />
          <Feature icon={KeyRound} title="Access stays under your control" text="Your account connects you to your team’s workspace." />
          <Feature icon={ShieldCheck} title="Authorized use, by design" text="Built for communication services you have permission to use." />
        </div>
      </section>
      <section aria-labelledby="auth-title" className="w-full max-w-md rounded-lg border border-border bg-surface p-6 sm:p-9 md:justify-self-end">
        <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">{register ? "Create your workspace" : "Welcome back"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{register ? "Start with your account and organization." : "Sign in to continue to your workspace."}</p>
        <form onSubmit={submit} noValidate className="mt-7 space-y-5" aria-busy={submitting}>
          <fieldset disabled={submitting} className="space-y-5">
            <legend className="sr-only">{register ? "New account details" : "Sign-in details"}</legend>
            {register && <>
              <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" maxLength={100} {...form.register("name")} aria-invalid={!!form.formState.errors.name} aria-describedby={form.formState.errors.name ? "name-error" : undefined} /><FieldError id="name-error" message={form.formState.errors.name?.message} /></div>
              <div className="space-y-2"><Label htmlFor="organization_name">Workspace name</Label><Input id="organization_name" autoComplete="organization" placeholder="Your organization" maxLength={100} {...form.register("organization_name")} aria-invalid={!!form.formState.errors.organization_name} aria-describedby={form.formState.errors.organization_name ? "organization-error" : undefined} /><FieldError id="organization-error" message={form.formState.errors.organization_name?.message} /></div>
            </>}
            <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="you@company.com" {...form.register("email")} aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? "email-error" : undefined} /><FieldError id="email-error" message={form.formState.errors.email?.message} /></div>
            <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={register ? "new-password" : "current-password"} {...form.register("password")} aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? "password-error" : register ? "password-help" : undefined} />{register && !form.formState.errors.password && <p id="password-help" className="text-xs leading-5 text-muted-foreground">Use at least 12 characters. Spaces and passphrases are welcome.</p>}<FieldError id="password-error" message={form.formState.errors.password?.message} /></div>
          </fieldset>
          {rootError && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive">{rootError}</p>}
          <Button type="submit" className="h-11 w-full" disabled={submitting}>{submitting ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{register ? "Creating workspace…" : "Signing in…"}</> : <>{register ? "Create workspace" : "Sign in"}<ArrowRight className="size-4" aria-hidden="true" /></>}</Button>
        </form>
        <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">{register ? "Already have an account?" : "New to NumDock?"}{" "}<Link to={register ? "/login" : "/register"} className="rounded-sm font-medium text-primary underline-offset-4 hover:underline">{register ? "Sign in" : "Create a workspace"}</Link></p>
      </section>
    </main>
    <footer className="flex flex-wrap justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:px-10"><span>NumDock · Communication resources</span><span>Authorized access only.</span></footer>
  </div>;
}

function FieldError({ id, message }: { id: string; message?: string }) { return message ? <p id={id} className="text-xs leading-5 text-destructive">{message}</p> : null; }

function Feature({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) {
  return <div className="flex gap-3.5"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></div>;
}
