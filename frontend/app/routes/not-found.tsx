import { data, type MetaFunction } from "react-router";
import { ErrorPage } from "@/components/error-page";
import { localizedMeta } from "@/lib/i18n/meta";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "common.pageNotFound");

// Matching this route lets the root locale loader run even for missing URLs.
export function loader() {
  return data(null, { status: 404 });
}

export default function NotFound() {
  return <ErrorPage missing />;
}
