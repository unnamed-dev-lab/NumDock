import { ArrowRight, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/motion/button/base";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useCatalogParams } from "@/features/catalog/use-catalog-params";
import { catalogUseCaseLabels } from "@/features/catalog/use-cases";
import { useCatalogNumbers, type CatalogInitial } from "@/hooks/api/catalog";

export function CatalogPulse({ initial }: { initial: CatalogInitial | null }) {
  const { t, i18n } = useTranslation();
  const { query } = useCatalogParams();
  const catalog = useCatalogNumbers(query, initial);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const data = catalog.data;
  const featured =
    data?.items.find((item) => item.capabilities.includes("sms")) ??
    data?.items[0];

  if (!data || data.mode !== "mock" || !featured) {
    const description = catalog.isError
      ? t("workspace.catalogErrorTitle")
      : data?.mode === "disabled"
        ? t("workspace.catalogDisabledDescription")
        : data?.mode === "mock" && data.items.length === 0
          ? t("home.catalogPreviewEmpty")
          : t("home.catalogDescription");

    return (
      <Card
        role="region"
        aria-label={t("home.catalogPreview")}
        aria-busy={catalog.isFetching}
        className="rounded-lg border-border shadow-none ring-1 ring-border"
      >
        <CardHeader>
          <p className="text-sm font-semibold">{t("home.catalogPreview")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <ButtonLink
            href="#numbers"
            variant="outline"
            size="sm"
            className="min-h-11"
          >
            {t("home.viewFullCatalog")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </CardContent>
      </Card>
    );
  }

  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: featured.currency,
  }).format(featured.monthly_fee_minor / 100);
  const count = new Intl.NumberFormat(locale).format(data.total);

  return (
    <Card
      role="region"
      aria-label={t("home.catalogPreview")}
      aria-busy={catalog.isFetching}
      className="rounded-lg border-border shadow-none ring-1 ring-border"
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{t("home.catalogPreview")}</p>
          <Badge variant="secondary">
            {t("workspace.developmentEnvironment")}
          </Badge>
        </div>
        <p
          className="flex items-baseline gap-2"
          aria-label={`${count} ${t("home.numbersListed")}`}
        >
          <NumberTicker
            aria-hidden="true"
            value={data.total}
            startValue={data.total}
            locale={locale}
            className="text-3xl font-semibold tracking-tight"
          />
          <span aria-hidden="true" className="text-sm text-muted-foreground">
            {t("home.numbersListed")}
          </span>
        </p>
        <p
          role="status"
          aria-live="polite"
          className="min-h-4 text-xs text-muted-foreground"
        >
          {catalog.isPlaceholderData ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t("home.catalogUpdating")}
            </span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("home.featuredNumber")}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold">
            {featured.e164}
          </p>
          <p className="text-xs text-muted-foreground">
            {featured.country_code} · {featured.region}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {featured.use_cases.slice(0, 3).map((useCase) => (
              <Badge key={useCase} variant="outline">
                {t(catalogUseCaseLabels[useCase] ?? "workspace.useCaseOther")}
              </Badge>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <p>
              <span className="text-lg font-semibold">{price}</span>
              <span className="text-xs text-muted-foreground">
                {" "}
                / {t("home.perMonth")}
              </span>
            </p>
            <ButtonLink
              href={`/app/numbers?tab=catalog&q=${encodeURIComponent(featured.e164)}`}
              variant="outline"
              size="sm"
              className="min-h-11"
            >
              {t("home.chooseThisNumber")}
            </ButtonLink>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {t("home.rentalTerms")}
          </p>
          <ButtonLink
            href="#numbers"
            variant="ghost"
            size="sm"
            className="min-h-11 px-0"
          >
            {t("home.viewFullCatalog")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}
