import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [index("routes/home.tsx"), route("login", "routes/login.tsx"), route("register", "routes/register.tsx"), route("app", "routes/workspace.tsx")] satisfies RouteConfig;
