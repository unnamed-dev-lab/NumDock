import type { CatalogQuery } from "@/hooks/api/catalog";
import type { TranslationKey } from "@/lib/i18n";

export const catalogUseCases = [
  "openai",
  "google",
  "telegram",
  "whatsapp",
  "discord",
  "tiktok",
  "amazon",
  "paypal",
  "uber",
  "x",
  "facebook",
  "instagram",
  "microsoft",
  "apple",
  "other",
] as const satisfies readonly NonNullable<CatalogQuery["use_case"]>[];

export type CatalogUseCase = (typeof catalogUseCases)[number];

export const catalogUseCaseLabels: Record<CatalogUseCase, TranslationKey> = {
  openai: "workspace.useCaseOpenai",
  google: "workspace.useCaseGoogle",
  telegram: "workspace.useCaseTelegram",
  whatsapp: "workspace.useCaseWhatsapp",
  discord: "workspace.useCaseDiscord",
  tiktok: "workspace.useCaseTiktok",
  amazon: "workspace.useCaseAmazon",
  paypal: "workspace.useCasePaypal",
  uber: "workspace.useCaseUber",
  x: "workspace.useCaseX",
  facebook: "workspace.useCaseFacebook",
  instagram: "workspace.useCaseInstagram",
  microsoft: "workspace.useCaseMicrosoft",
  apple: "workspace.useCaseApple",
  other: "workspace.useCaseOther",
};

export function isCatalogUseCase(
  value: string | null,
): value is CatalogUseCase {
  return (
    value !== null && (catalogUseCases as readonly string[]).includes(value)
  );
}
