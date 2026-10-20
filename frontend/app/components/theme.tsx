import { useTranslation } from "react-i18next";
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { useThemeToggle } from "@/components/motion/theme-toggle";
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
import { useTheme } from "@/lib/theme-context";

export { ThemeProvider, themeScript } from "@/lib/theme-context";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { change, busy } = useThemeToggle({ start: "top-right" });
  const Icon = theme === "system" ? Laptop : theme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-10"
            aria-label={t(
              theme === "dark"
                ? "common.themeDarkLabel"
                : theme === "light"
                  ? "common.themeLightLabel"
                  : "common.themeSystemLabel",
            )}
            disabled={busy}
          >
            <Icon className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("common.appearance")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={theme} onValueChange={change}>
            <DropdownMenuRadioItem value="light" disabled={busy} closeOnClick>
              <Sun aria-hidden="true" />
              {t("common.light")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" disabled={busy} closeOnClick>
              <Moon aria-hidden="true" />
              {t("common.dark")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" disabled={busy} closeOnClick>
              <Laptop aria-hidden="true" />
              {t("common.system")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
