export const locales = ["en", "zh-CN"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "numdock.locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

/** The same supported language is used for server HTML and hydration. */
export function resolveLocale(request: Request): Locale {
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .find((part) => part.trim().startsWith(`${localeCookie}=`))
    ?.trim()
    .slice(localeCookie.length + 1);
  if (isLocale(cookie)) return cookie;

  const languages = (request.headers.get("Accept-Language") ?? "")
    .split(",")
    .map((part) => {
      const [language = "", ...parameters] = part.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const weight = quality ? Number(quality.trim().slice(2)) : 1;
      return { language: language.toLowerCase(), weight };
    })
    .filter(
      ({ weight }) => Number.isFinite(weight) && weight > 0 && weight <= 1,
    )
    .sort((a, b) => b.weight - a.weight);
  for (const { language } of languages) {
    if (language === "zh" || language.startsWith("zh-")) return "zh-CN";
    if (language === "en" || language.startsWith("en-")) return "en";
  }
  return defaultLocale;
}
