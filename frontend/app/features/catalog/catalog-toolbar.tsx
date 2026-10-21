import { RotateCcw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogStore } from "./catalog-store";

export function CatalogToolbar() {
  const { t } = useTranslation();
  const {
    globalFilter,
    setGlobalFilter,
    countryFilter,
    setCountryFilter,
    typeFilter,
    setTypeFilter,
    capabilityFilter,
    setCapabilityFilter,
    resetFilters,
  } = useCatalogStore();

  const isFiltered =
    Boolean(globalFilter) ||
    countryFilter !== "all" ||
    typeFilter !== "all" ||
    capabilityFilter !== "all";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-2 sm:flex-row sm:items-center">
      {/* Search input */}
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder={t("workspace.searchNumbersPlaceholder", {
            defaultValue: "搜索号码、城市或运营商...",
          })}
          className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {/* Filter Selects */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Country Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("workspace.filterCountry", { defaultValue: "国家/地区:" })}
          </span>
          <Select
            value={countryFilter}
            onValueChange={(val) => {
              if (val) setCountryFilter(val);
            }}
          >
            <SelectTrigger size="sm" className="h-9 min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">
                {t("workspace.filterAllCountries", { defaultValue: "全部国家/地区" })}
              </SelectItem>
              <SelectItem value="US">🇺🇸 {t("workspace.countryUS", { defaultValue: "美国 (US)" })}</SelectItem>
              <SelectItem value="GB">🇬🇧 {t("workspace.countryGB", { defaultValue: "英国 (GB)" })}</SelectItem>
              <SelectItem value="DE">🇩🇪 {t("workspace.countryDE", { defaultValue: "德国 (DE)" })}</SelectItem>
              <SelectItem value="JP">🇯🇵 {t("workspace.countryJP", { defaultValue: "日本 (JP)" })}</SelectItem>
              <SelectItem value="SG">🇸🇬 {t("workspace.countrySG", { defaultValue: "新加坡 (SG)" })}</SelectItem>
              <SelectItem value="CA">🇨🇦 {t("workspace.countryCA", { defaultValue: "加拿大 (CA)" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("workspace.filterType", { defaultValue: "类型:" })}
          </span>
          <Select
            value={typeFilter}
            onValueChange={(val) => {
              if (val) setTypeFilter(val);
            }}
          >
            <SelectTrigger size="sm" className="h-9 min-w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">
                {t("workspace.filterAllTypes", { defaultValue: "全部类型" })}
              </SelectItem>
              <SelectItem value="mobile">
                {t("workspace.typeMobile", { defaultValue: "移动号码" })}
              </SelectItem>
              <SelectItem value="local">
                {t("workspace.typeLocal", { defaultValue: "本地号码" })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Capability Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("workspace.filterCapability", { defaultValue: "验证服务:" })}
          </span>
          <Select
            value={capabilityFilter}
            onValueChange={(val) => {
              if (val) setCapabilityFilter(val);
            }}
          >
            <SelectTrigger size="sm" className="h-9 min-w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">
                {t("workspace.filterAllCapabilities", { defaultValue: "全部能力" })}
              </SelectItem>
              <SelectItem value="auth_whatsapp">WhatsApp</SelectItem>
              <SelectItem value="auth_google">Google</SelectItem>
              <SelectItem value="auth_telegram">Telegram</SelectItem>
              <SelectItem value="auth_bank_2fa">
                {t("workspace.capBank2FA", { defaultValue: "银行 2FA" })}
              </SelectItem>
              <SelectItem value="auth_openai">OpenAI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset filters button */}
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
            {t("workspace.resetFilters", { defaultValue: "重置" })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
