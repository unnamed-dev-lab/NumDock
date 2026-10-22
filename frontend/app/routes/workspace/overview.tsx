import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { WorkspaceOverview } from "@/features/workspace/workspace-overview";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.overview");

export default function OverviewRoute() {
  return <WorkspaceOverview />;
}
