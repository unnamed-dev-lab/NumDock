import type { MetaFunction } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleDashed,
  Database,
  Globe2,
  Inbox,
  RefreshCw,
  Server,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/motion/button/base";
import {
  PublicFooter,
  PublicHeader,
} from "@/features/marketing/public-shell";
import { StatusBadge } from "@/features/workspace/workspace-ui";
import { localizedMeta } from "@/lib/i18n/meta";
import { fetchPublicStatus } from "@/lib/public-status.server";

export const meta: MetaFunction = ({ matches }) => [
  ...localizedMeta(matches, "status.title", "status.description"),
  { name: "robots", content: "index, follow" },
];

export async function loader() {
  return { status: await fetchPublicStatus() };
}

export default function StatusPage() {
  const { t } = useTranslation();
  const { status } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  const services = [
    {
      key: "status.api",
      online: status.api,
      icon: Server,
    },
    {
      key: "status.database",
      online: status.database,
      icon: Database,
    },
    {
      key: "status.identity",
      online: status.api,
      icon: ShieldCheck,
    },
  ] as const;

  const modules = [
    { key: "status.catalog", icon: Globe2 },
    { key: "status.messaging", icon: Inbox },
    { key: "status.billing", icon: Wallet },
  ] as const;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-primary">{t("status.eyebrow")}</p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {t("status.title")}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {t("status.description")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={revalidator.state !== "idle"}
              onClick={() => revalidator.revalidate()}
            >
              <RefreshCw
                className={
                  revalidator.state === "idle"
                    ? "size-3.5"
                    : "size-3.5 animate-spin motion-reduce:animate-none"
                }
                aria-hidden="true"
              />
              {t("status.retry")}
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("status.checkedAt", {
              time: `${status.checkedAt.slice(11, 16)} UTC`,
            })}
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("status.platformTitle")}
              </h2>
              <div className="mt-5 overflow-hidden rounded-lg border border-border bg-background">
                <ul className="divide-y divide-border">
                  {services.map((service) => {
                    const Icon = service.icon;
                    return (
                      <li
                        key={service.key}
                        className="flex items-center justify-between gap-4 px-4 py-3.5"
                      >
                        <span className="flex items-center gap-3 text-sm text-foreground">
                          <Icon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {t(service.key)}
                        </span>
                        <StatusBadge tone={service.online ? "active" : "warning"}>
                          <span className="flex items-center gap-1.5">
                            {service.online ? (
                              <CheckCircle2 className="size-3" aria-hidden="true" />
                            ) : (
                              <CircleDashed className="size-3" aria-hidden="true" />
                            )}
                            {service.online
                              ? t("status.online")
                              : t("status.offline")}
                          </span>
                        </StatusBadge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {t("status.modulesTitle")}
              </h2>
              <div className="mt-5 overflow-hidden rounded-lg border border-border bg-background">
                <ul className="divide-y divide-border">
                  {modules.map((module) => {
                    const Icon = module.icon;
                    return (
                      <li
                        key={module.key}
                        className="flex items-center justify-between gap-4 px-4 py-3.5"
                      >
                        <span className="flex items-center gap-3 text-sm text-foreground">
                          <Icon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {t(module.key)}
                        </span>
                        <StatusBadge tone="neutral">
                          {t("status.notConfigured")}
                        </StatusBadge>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {t("status.publicNotice")}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {t("status.beforeTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("status.beforeDescription")}
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
