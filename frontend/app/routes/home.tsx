import type { MetaFunction, ShouldRevalidateFunction } from "react-router";
import type { Route } from "./+types/home";
import { useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { Check, Inbox, PhoneCall, Search, ShieldCheck } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/features/marketing/public-shell";
import { CatalogPulse } from "@/features/marketing/catalog-pulse";
import { HeroSearch } from "@/features/marketing/hero-search";
import { CatalogView } from "@/features/catalog/catalog-view";
import { localizedMeta } from "@/lib/i18n/meta";
import { fetchPublicCatalog } from "@/lib/public-catalog.server";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "home.title", "home.description"),
  { name: "robots", content: "index, follow" },
];
export async function loader({ request }: Route.LoaderArgs) {
  return { catalog: await fetchPublicCatalog(request) };
}
// Search and pagination use the shared Query cache without a second SSR fetch.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;

export default function Home() {
  const { t } = useTranslation();
  const { catalog } = useLoaderData<typeof loader>();
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-5 pb-10 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
            <PhoneCall className="size-4" aria-hidden="true" />
            {t("home.productLabel")}
          </p>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12">
            <div>
              <h1 className="max-w-3xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {t("home.shopTitle")}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                {t("home.shopDescription")}
              </p>
              <HeroSearch />
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {(
                  [
                    "home.browseFreely",
                    "home.transparentPricing",
                    "home.privateInbox",
                  ] as const
                ).map((key) => (
                  <span key={key} className="inline-flex items-center gap-2">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                    {t(key)}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden lg:block">
              <CatalogPulse initial={catalog} />
            </div>
          </div>
        </section>

        <section
          id="numbers"
          aria-labelledby="catalog-heading"
          className="scroll-mt-20 border-y border-border bg-surface"
        >
          <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="catalog-heading"
                  className="text-xl font-semibold tracking-tight sm:text-2xl"
                >
                  {t("home.numbersAndPricing")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("home.catalogDescription")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("home.billingUnit")}
              </p>
            </div>
            <CatalogView publicBrowsing initial={catalog} />
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("home.stepsTitle")}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
              {t("home.stepsDescription")}
            </p>
          </div>
          <ol className="divide-y divide-border border-y border-border">
            {(
              [
                {
                  icon: Search,
                  title: "home.stepSearchTitle",
                  description: "home.stepSearchDescription",
                },
                {
                  icon: ShieldCheck,
                  title: "home.stepConfirmTitle",
                  description: "home.stepConfirmDescription",
                },
                {
                  icon: Inbox,
                  title: "home.stepLeaseTitle",
                  description: "home.stepLeaseDescription",
                },
              ] as const
            ).map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="flex gap-4 py-5">
                <span className="mt-0.5 w-6 shrink-0 font-mono text-xs font-medium text-primary">
                  0{index + 1}
                </span>
                <Icon
                  className="mt-1 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-semibold">{t(title)}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t(description)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
