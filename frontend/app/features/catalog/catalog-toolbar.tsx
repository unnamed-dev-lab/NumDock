import { RotateCcw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useCatalogParams } from "./use-catalog-params";
import { catalogUseCaseLabels, catalogUseCases } from "./use-cases";

export function CatalogToolbar({
  query,
  update,
  reset,
}: ReturnType<typeof useCatalogParams>) {
  const { t } = useTranslation();
  const isFiltered = Boolean(
    query.q ||
    query.country ||
    query.number_type ||
    query.capability ||
    query.use_case,
  );
  const countries = [
    { value: "all", label: t("workspace.filterAllCountries") },
    { value: "US", label: t("workspace.countryUS") },
    { value: "CA", label: t("workspace.countryCA") },
  ];
  if (
    query.country &&
    !countries.some((item) => item.value === query.country)
  ) {
    countries.push({ value: query.country, label: query.country });
  }
  const types = [
    { value: "all", label: t("workspace.filterAllTypes") },
    { value: "mobile", label: t("workspace.typeMobile") },
    { value: "local", label: t("workspace.typeLocal") },
    { value: "toll_free", label: t("workspace.typeTollFree") },
  ];
  const capabilities = [
    { value: "all", label: t("workspace.filterAllCapabilities") },
    { value: "sms", label: t("workspace.capabilitySms") },
    { value: "voice", label: t("workspace.capabilityVoice") },
    { value: "mms", label: t("workspace.capabilityMms") },
  ];
  const useCases = [
    { value: "all", label: t("workspace.filterAllUseCases") },
    ...catalogUseCases.map((value) => ({
      value,
      label: t(catalogUseCaseLabels[value]),
    })),
  ];
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="min-w-0 flex-1 sm:min-w-56">
        <Input
          type="search"
          aria-label={t("workspace.searchNumbersPlaceholder")}
          value={query.q ?? ""}
          onChange={(value) => update({ q: value })}
          maxLength={100}
          placeholder={t("workspace.searchNumbersPlaceholder")}
          leftIcon={<Search className="size-4" aria-hidden="true" />}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={countries}
          value={query.country ?? "all"}
          onValueChange={(value) => {
            if (value) update({ country: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-9 min-w-32"
            aria-label={t("workspace.filterCountry")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countries.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={types}
          value={query.number_type ?? "all"}
          onValueChange={(value) => {
            if (value) update({ number_type: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-9 min-w-28"
            aria-label={t("workspace.filterType")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={capabilities}
          value={query.capability ?? "all"}
          onValueChange={(value) => {
            if (value) update({ capability: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-9 min-w-28"
            aria-label={t("workspace.filterCapability")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {capabilities.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={useCases}
          value={query.use_case ?? "all"}
          onValueChange={(value) => {
            if (value) update({ use_case: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-9 min-w-32"
            aria-label={t("workspace.filterUseCase")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {useCases.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltered ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t("workspace.resetFilters")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
