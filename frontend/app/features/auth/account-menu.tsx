import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";
import type { Identity } from "@/lib/api/client";
import { initials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu({
  identity,
  signingOut,
  onSignOut,
}: {
  identity: Identity;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("workspace.accountMenu")}
        className="flex h-11 items-center gap-2 rounded-md px-1.5 text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
          {initials(identity.user.name)}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium text-foreground sm:block">
          {identity.user.name}
        </span>
        <ChevronDown
          className="hidden size-3.5 text-muted-foreground sm:block"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-foreground">
              {identity.user.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {identity.user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate("/app")}>
          <LayoutDashboard className="size-4" aria-hidden="true" />
          {t("home.openWorkspace")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void navigate("/app/settings")}>
          <Settings className="size-4" aria-hidden="true" />
          {t("workspace.workspaceSettings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onClick={onSignOut}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? t("workspace.signingOut") : t("workspace.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
