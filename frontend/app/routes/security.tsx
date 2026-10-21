import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  LockKeyhole,
  Server,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/motion/button/base";
import {
  PublicFooter,
  PublicHeader,
} from "@/features/marketing/public-shell";
import { localizedMeta } from "@/lib/i18n/meta";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "security.title", "security.description"),
  { name: "robots", content: "index, follow" },
];

const securityItems = [
  {
    key: "home.securitySessionTitle",
    description: "home.securitySessionDescription",
    icon: Server,
  },
  {
    key: "home.securityNoSharedTitle",
    description: "home.securityNoSharedDescription",
    icon: LockKeyhole,
  },
  {
    key: "home.securityAuditTitle",
    description: "home.securityAuditDescription",
    icon: ShieldCheck,
  },
] as const;

export default function SecurityPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-xs font-medium text-primary">{t("security.eyebrow")}</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t("security.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("security.description")}
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("home.securityTitle")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t("home.securityDescription")}
              </p>
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {securityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <div>
                      <h2 className="text-sm font-medium text-foreground">
                        {t(item.key)}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t(item.description)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2.5">
              <UserCheck className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("security.accessTitle")}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("security.accessDescription")}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <LockKeyhole className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("security.dataTitle")}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("security.dataDescription")}
            </p>
          </div>
        </section>

        <section className="border-t border-border bg-accent/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("security.ctaTitle")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {t("security.ctaDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/register" size="md" className="rounded-md">
                {t("home.primaryCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href="/status"
                variant="outline"
                size="md"
                className="rounded-md"
              >
                {t("home.viewStatus")}
              </ButtonLink>
            </div>
          </div>
        </section>
        <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
          <Link
            to="/platform"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("security.backToPlatform")}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
