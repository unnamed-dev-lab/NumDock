import type { MetaFunction } from "react-router";
import { localizedMeta } from "@/lib/i18n/meta";
import { useOutletContext } from "react-router";
import { WorkspaceOverview } from "@/features/workspace/workspace-overview";
import type { WorkspaceOutletContext } from "@/routes/workspace";

export const meta: MetaFunction = ({ matches }) =>
  localizedMeta(matches, "workspace.overview");

export default function OverviewRoute() {
  const { identity } = useOutletContext<WorkspaceOutletContext>();
  return <WorkspaceOverview identity={identity} />;
}
