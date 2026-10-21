import type { MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe2,
  Inbox,
  LockKeyhole,
  ReceiptText,
  Server,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ButtonLink } from "@/components/motion/button/base";
import {
  PublicFooter,
  PublicHeader,
} from "@/features/marketing/public-shell";
import { localizedMeta } from "@/lib/i18n/meta";
import { fetchPublicStatus } from "@/lib/public-status.server";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "home.title", "home.description"),
  { name: "robots", content: "index, follow" },
];

export async function loader() {
  return { status: await fetchPublicStatus() };
}

const publicLinks = [
  {
    to: "/platform",
    title: "home.publicPlatform",
    description: "platform.publicDescription",
    icon: Globe2,
  },
  {
    to: "/status",
    title: "home.navStatus",
    description: "status.description",
    icon: Server,
  },
  {
    to: "/docs/api",
    title: "home.publicApi",
    description: "home.publicApiDescription",
    icon: BookOpen,
  },
] as const;

const gatedLinks = [
  { key: "home.signInForBuy", icon: Wallet },
  { key: "home.signInForMessages", icon: Inbox },
  { key: "home.signInForBilling", icon: ReceiptText },
] as const;

export default function Home() {
  const { t } = useTranslation();
  const { status } = useLoaderData<typeof loader>();

  const serviceRows = [
    {
      key: "status.api",
      online: status.api,
      label: status.api ? "status.online" : "status.offline",
      icon: Server,
    },
    {
      key: "status.database",
      online: status.database,
      label: status.database ? "status.online" : "status.offline",
      icon: CheckCircle2,
    },
    {
      key: "status.identity",
      online: status.api,
      label: status.api ? "status.online" : "status.offline",
      icon: ShieldCheck,
    },
    {
      key: "status.catalog",
      online: false,
      label: "status.notConfigured",
      icon: Globe2,
    },
    {
      key: "status.messaging",
      online: false,
      label: "status.notConfigured",
      icon: Inbox,
    },
    {
      key: "status.billing",
      online: false,
      label: "status.notConfigured",
      icon: Wallet,
    },
  ] as const;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />

      <main id="main-content" className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:items-center">
          <div>
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-5xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("home.heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/platform" size="lg" className="rounded-md">
                {t("home.viewPlatform")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href="/status"
                variant="outline"
                size="lg"
                className="rounded-md"
              >
                {t("home.viewStatus")}
              </ButtonLink>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <p className="text-sm font-medium text-foreground">
                {t("home.readiness")}
              </p>
              <span className="text-xs text-muted-foreground">
                {t("home.currentBuild")}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {serviceRows.map((row) => {
                const Icon = row.icon;
                return (
                  <li
                    key={row.key}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2.5 text-muted-foreground">
                      <Icon
                        className={
                          row.online
                            ? "size-4 text-success"
                            : "size-4 text-muted-foreground"
                        }
                        aria-hidden="true"
                      />
                      {t(row.key)}
                    </span>
                    <span
                      className={
                        row.online
                          ? "text-xs font-medium text-success"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {t(row.label)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link
              to="/status"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("home.openStatus")}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="max-w-md font-display text-3xl font-semibold tracking-tight text-foreground">
                {t("home.publicAccessTitle")}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                {t("home.publicAccessDescription")}
              </p>
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {publicLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group flex items-start gap-4 py-5 first:pt-0 last:pb-0"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {t(item.title)}
                          <ArrowRight
                            className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                          {t(item.description)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="max-w-md font-display text-3xl font-semibold tracking-tight text-foreground">
              {t("home.signInForTitle")}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              {t("home.signInForDescription")}
            </p>
            <ButtonLink href="/register" size="md" className="mt-6 rounded-md">
              {t("home.primaryCta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {gatedLinks.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <LockKeyhole
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {t(item.key)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-t border-border bg-accent/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("home.ctaTitle")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {t("home.ctaDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/register" size="md" className="rounded-md">
                {t("home.primaryCta")}
              </ButtonLink>
              <ButtonLink
                href="/login"
                variant="outline"
                size="md"
                className="rounded-md"
              >
                {t("home.secondaryCta")}
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
