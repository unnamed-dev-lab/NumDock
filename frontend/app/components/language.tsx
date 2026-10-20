import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRevalidator } from "react-router";
import { Button } from "@/components/motion/button/base";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isLocale, localeCookie } from "@/lib/i18n/locale";

/** Business composition of the existing CLI-installed Base UI menu. */
export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const revalidator = useRevalidator();
  const busy = revalidator.state !== "idle";

  function change(value: unknown) {
    if (!isLocale(value) || busy || value === i18n.language) return;
    document.cookie = `${localeCookie}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    // Refresh the root locale and route metadata together; forms and query caches survive.
    void revalidator.revalidate();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-10"
            aria-label={t("common.language")}
            disabled={busy}
          >
            <Languages className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={i18n.language} onValueChange={change}>
            <DropdownMenuRadioItem value="en" lang="en" closeOnClick>
              English
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="zh-CN" lang="zh-CN" closeOnClick>
              简体中文
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
