import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { AuthPage } from "@/components/auth-page";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "auth.registerTitle", "auth.registerDescription"),
  { name: "robots", content: "noindex, nofollow" },
];
export default function Register() {
  return <AuthPage mode="register" />;
}
