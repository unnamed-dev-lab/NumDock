import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("platform", "routes/platform.tsx"),
  route("security", "routes/security.tsx"),
  route("status", "routes/status.tsx"),
  route("docs/api", "routes/api-docs.tsx"),
  route("app", "routes/workspace.tsx", [
    index("routes/workspace/overview.tsx"),
    route("numbers", "routes/workspace/numbers.tsx"),
    route("messages", "routes/workspace/messages.tsx"),
    route("billing", "routes/workspace/billing.tsx"),
    route("developers", "routes/workspace/developers.tsx"),
    route("settings", "routes/workspace/settings.tsx"),
    route("catalog", "routes/workspace/catalog.tsx"),
    route("inbox", "routes/workspace/inbox.tsx"),
    route("orders", "routes/workspace/orders.tsx"),
    route("keys", "routes/workspace/keys.tsx"),
    route("admin", "routes/workspace/admin.tsx"),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
