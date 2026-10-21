import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  Globe2,
  Inbox,
  KeyRound,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ButtonLink } from "@/components/motion/button/base";
import {
  PublicFooter,
  PublicHeader,
} from "@/features/marketing/public-shell";
import { StatusBadge } from "@/features/workspace/workspace-ui";
import { localizedMeta } from "@/lib/i18n/meta";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "platform.title", "platform.description"),
  { name: "robots", content: "index, follow" },
];

const gatedItems = [
  { key: "home.signInForBuy" as const, icon: ReceiptText },
  { key: "home.signInForMessages" as const, icon: Inbox },
  { key: "home.signInForBilling" as const, icon: Wallet },
];

const modules = [
  {
    key: "workspace.identityAccess",
    status: "workspace.active",
    tone: "active" as const,
    icon: ShieldCheck,
  },
  {
    key: "workspace.numberCatalog",
    status: "workspace.notConnected",
    tone: "neutral" as const,
    icon: Globe2,
  },
  {
    key: "workspace.inboundMessaging",
    status: "workspace.notConnected",
    tone: "neutral" as const,
    icon: Inbox,
  },
  {
    key: "workspace.billingLedger",
    status: "workspace.notEnabled",
    tone: "neutral" as const,
    icon: Wallet,
  },
  {
    key: "workspace.apiWebhooks",
    status: "workspace.planned",
    tone: "neutral" as const,
    icon: KeyRound,
  },
] as const;

export default function PlatformPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-xs font-medium text-primary">
            {t("platform.eyebrow")}
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t("platform.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("platform.description")}
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("platform.modulesTitle")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t("platform.modulesDescription")}
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <ul className="divide-y divide-border">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <li
                      key={module.key}
                      className="flex items-center justify-between gap-4 px-4 py-3.5"
                    >
                      <span className="flex items-center gap-3 text-sm text-foreground">
                        <Icon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {t(module.key)}
                      </span>
                      <StatusBadge tone={module.tone}>
                        {t(module.status)}
                      </StatusBadge>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {t("platform.publicTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("platform.publicDescription")}
            </p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              <li className="flex items-start gap-3 py-4 first:pt-0">
                <Globe2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <Link
                  to="/status"
                  className="text-sm leading-6 text-foreground underline-offset-4 hover:underline"
                >
                  {t("home.navStatus")}
                </Link>
              </li>
              <li className="flex items-start gap-3 py-4 last:pb-0">
                <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <Link
                  to="/docs/api"
                  className="text-sm leading-6 text-foreground underline-offset-4 hover:underline"
                >
                  {t("home.navApi")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {t("platform.authTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("platform.authDescription")}
            </p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {gatedItems.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm leading-6 text-muted-foreground">
                    {t(key)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border bg-accent/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("home.ctaTitle")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {t("home.ctaDescription")}
              </p>
            </div>
            <ButtonLink href="/register" size="md" className="rounded-md">
              {t("home.primaryCta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
