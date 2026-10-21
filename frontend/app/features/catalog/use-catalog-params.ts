import { useSearchParams } from "react-router";
import type { paths } from "@/lib/api/schema";

type CatalogQuery = NonNullable<
  paths["/v1/catalog/numbers"]["get"]["parameters"]["query"]
>;
const filterKeys = [
  "q",
  "country",
  "number_type",
  "capability",
  "sort",
  "order",
  "limit",
  "offset",
];
const choose = <T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T => options.find((option) => option === value) ?? fallback;
function integer(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const n = value === null || !/^\d+$/.test(value) ? NaN : Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
}

export function useCatalogParams() {
  const [params, setParams] = useSearchParams();
  const country = params.get("country") ?? "";
  const query: CatalogQuery = {
    q: Array.from(params.get("q") ?? "")
      .slice(0, 100)
      .join(""),
    country: /^[A-Z]{2}$/.test(country) ? country : undefined,
    number_type:
      choose(
        params.get("number_type"),
        ["mobile", "local", "toll_free", ""] as const,
        "",
      ) || undefined,
    capability:
      choose(
        params.get("capability"),
        ["sms", "voice", "mms", ""] as const,
        "",
      ) || undefined,
    sort: choose(
      params.get("sort"),
      ["e164", "monthly_fee_minor", "inbound_sms_fee_micros"] as const,
      "e164",
    ),
    order: choose(params.get("order"), ["asc", "desc"] as const, "asc"),
    limit: integer(params.get("limit"), 10, 1, 100),
    offset: integer(params.get("offset"), 0, 0, 2147483647),
  };
  const update = (
    changes: Record<string, string | number | undefined>,
    resetPage = true,
  ) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (resetPage) next.delete("offset");
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === "" || value === "all")
            next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };
  const reset = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of filterKeys) next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };
  return { query, update, reset };
}
