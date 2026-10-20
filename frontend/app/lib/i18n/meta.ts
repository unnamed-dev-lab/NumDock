import { createI18n, type TranslationKey } from "./index";
import { defaultLocale, isLocale } from "./locale";

export function localizedMeta(
  matches: readonly ({ id?: string; data?: unknown } | undefined)[],
  title: TranslationKey,
  description?: TranslationKey,
) {
  const root = matches.find((match) => match?.id === "root")?.data;
  const locale =
    root &&
    typeof root === "object" &&
    "locale" in root &&
    isLocale(root.locale)
      ? root.locale
      : defaultLocale;
  const t = createI18n(locale).t;
  const page = t(title);
  return [
    {
      title: title.startsWith("auth.") ? page : t("common.pageTitle", { page }),
    },
    ...(description ? [{ name: "description", content: t(description) }] : []),
  ];
}
