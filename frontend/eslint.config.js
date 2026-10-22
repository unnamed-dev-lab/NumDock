import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "app/lib/api/schema.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/hooks/api/**", "app/lib/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              importNames: [
                "useQuery",
                "useMutation",
                "useQueryClient",
                "useQueries",
                "useInfiniteQuery",
                "useSuspenseQuery",
                "queryOptions",
                "mutationOptions",
              ],
              message:
                "Declare API queries, mutations, keys and cache effects in app/hooks/api.",
            },
            {
              name: "@/lib/api/client",
              importNames: ["api", "unwrap", "csrfHeaders"],
              message:
                "Use app/hooks/api for browser data and app/lib/api/server for loaders.",
            },
            {
              name: "openapi-fetch",
              message: "Create API clients in app/lib/api.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use app/hooks/api for browser data and app/lib/api/server for loaders.",
        },
      ],
    },
  },
);
