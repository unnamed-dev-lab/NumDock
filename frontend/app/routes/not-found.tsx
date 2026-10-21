import { data, type MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { Brand } from "@/components/brand";
import { LanguageMenu } from "@/components/language";
import { NotFoundStacked } from "@/components/motion/not-found/stacked";
import { ThemeToggle } from "@/components/theme";
import { localizedMeta } from "@/lib/i18n/meta";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(
    matches,
    "common.pageNotFound",
    "notFound.description",
  ),
  { name: "robots", content: "noindex, nofollow" },
];

// Matching this route lets the root locale loader run even for missing URLs.
export function loader() {
  return data(null, { status: 404 });
}

export default function NotFound() {
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
        className="flex flex-1 items-center justify-center px-5 py-12"
      >
        <NotFoundStacked
          className="min-h-0"
          title={t("common.pageNotFound")}
          description={t("notFound.description")}
          homeHref="/"
          homeLabel={t("notFound.backHome")}
          browseHref="/app"
          browseLabel={t("notFound.openWorkspace")}
        />
      </main>
    </div>
  );
}
