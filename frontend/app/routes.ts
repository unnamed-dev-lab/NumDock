import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("security", "routes/security.tsx"),
  route("app", "routes/workspace.tsx", [
    index("routes/workspace/overview.tsx"),
    route("numbers", "routes/workspace/numbers.tsx"),
    route("messages", "routes/workspace/messages.tsx"),
    route("billing", "routes/workspace/billing.tsx"),
    route("settings", "routes/workspace/settings.tsx"),
    route("catalog", "routes/workspace/catalog.tsx"),
    route("inbox", "routes/workspace/inbox.tsx"),
    route("orders", "routes/workspace/orders.tsx"),
    route("admin", "routes/workspace/admin.tsx"),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
