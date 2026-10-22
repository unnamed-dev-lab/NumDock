import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  catalogUseCaseLabels,
  catalogUseCases,
  type CatalogUseCase,
  isCatalogUseCase,
} from "@/features/catalog/use-cases";
import { cn } from "@/lib/utils";

const quickUseCases = [
  "openai",
  "google",
  "telegram",
  "whatsapp",
  "discord",
] as const satisfies readonly CatalogUseCase[];
const quickUseCaseSet = new Set<string>(quickUseCases);
const moreUseCases = catalogUseCases.filter(
  (useCase) => !quickUseCaseSet.has(useCase),
);

export function HeroSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reduce = useReducedMotion();
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const rawUseCase = params.get("use_case");
  const activeUseCase = isCatalogUseCase(rawUseCase) ? rawUseCase : undefined;
  const moreActive =
    activeUseCase !== undefined && moreUseCases.includes(activeUseCase);

  useEffect(() => setQuery(urlQuery), [urlQuery]);

  const scrollToCatalog = () => {
    requestAnimationFrame(() => {
      document.getElementById("numbers")?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const key of ["country", "number_type", "capability"] as const) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    const trimmed = query.trim().slice(0, 100);
    if (trimmed) next.set("q", trimmed);
    if (activeUseCase) next.set("use_case", activeUseCase);
    const search = next.toString();
    void navigate(
      {
        pathname: "/",
        search: search ? `?${search}` : "",
        hash: "#numbers",
      },
      { preventScrollReset: true },
    );
    scrollToCatalog();
  };

  const quickHref = (useCase?: CatalogUseCase) => {
    const next = new URLSearchParams();
    if (useCase) next.set("use_case", useCase);
    const search = next.toString();
    return {
      pathname: "/",
      search: search ? `?${search}` : "",
      hash: "#numbers",
    };
  };

  return (
    <div className="mt-6">
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          type="search"
          aria-label={t("home.searchLabel")}
          placeholder={t("home.searchPlaceholder")}
          value={query}
          onChange={setQuery}
          maxLength={100}
          leftIcon={<Search className="size-4" aria-hidden="true" />}
          className="min-w-0 flex-1"
        />
        <Button type="submit" className="h-11 shrink-0 px-5">
          {t("home.searchAction")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <nav aria-label={t("home.browseByUseCase")} className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("home.browseByUseCase")}
        </p>
        <SharedLayoutBg
          className="mt-2 flex-row flex-wrap items-center gap-1"
          pillClassName="rounded-full bg-muted/80"
          inset={0}
        >
          <Link
            to={quickHref()}
            preventScrollReset
            onClick={scrollToCatalog}
            aria-current={!activeUseCase ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              !activeUseCase
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("home.allNumbers")}
          </Link>
          {quickUseCases.map((useCase) => {
            const active = activeUseCase === useCase;
            return (
              <Link
                key={useCase}
                to={quickHref(useCase)}
                preventScrollReset
                onClick={scrollToCatalog}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(catalogUseCaseLabels[useCase])}
              </Link>
            );
          })}
          <div key="more-use-cases">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "min-h-11 rounded-full px-3 text-sm hover:bg-transparent",
                      moreActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {moreActive && activeUseCase
                      ? t(catalogUseCaseLabels[activeUseCase])
                      : t("home.moreUseCases")}
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="min-w-44">
                {moreUseCases.map((useCase) => (
                  <DropdownMenuItem
                    key={useCase}
                    onClick={() => {
                      void navigate(quickHref(useCase), {
                        preventScrollReset: true,
                      });
                      scrollToCatalog();
                    }}
                  >
                    {t(catalogUseCaseLabels[useCase])}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SharedLayoutBg>
      </nav>
    </div>
  );
}
