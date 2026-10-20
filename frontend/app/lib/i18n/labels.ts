import type { TFunction } from "i18next";
import type { TranslationKey } from "./index";
import en from "./locales/en.json";

export function isTranslationKey(value: string): value is TranslationKey {
  return Object.hasOwn(en, value);
}

const roles: Record<string, TranslationKey> = {
  owner: "common.roleOwner",
  admin: "common.roleAdmin",
  member: "common.roleMember",
  viewer: "common.roleViewer",
};

export function roleLabel(role: string, t: TFunction): string {
  return roles[role] ? t(roles[role]) : role;
}
