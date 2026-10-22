import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

const devAppOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

function isLocalDevOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

const localDevOrigin = isLocalDevOrigin(devAppOrigin)
  ? new URL(devAppOrigin)
  : null;

function isLocalhostOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function devPortFallbackNotice(): Plugin {
  return {
    name: "numdock-dev-port-fallback",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        if (!address || typeof address === "string" || !localDevOrigin) {
          return;
        }
        const expectedPort =
          localDevOrigin.port ||
          (localDevOrigin.protocol === "https:" ? "443" : "80");
        if (String(address.port) === expectedPort) return;
        server.config.logger.warn(
          `[numdock] Frontend is using port ${address.port}; /v1 requests rewrite Origin to ${devAppOrigin}. ` +
            `For exact-origin checks outside the dev proxy, set APP_ORIGIN to match the actual port.`,
        );
      });
    },
  };
}

function checkBackendContract(): Plugin {
  return {
    name: "numdock-api-contract-check",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        void (async () => {
          const target =
            process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080";
          try {
            const response = await fetch(
              `${target.replace(/\/$/, "")}/v1/openapi.yaml`,
              { signal: AbortSignal.timeout(2500) },
            );
            const spec = await response.text();
            if (
              !response.ok ||
              !spec.includes("/v1/organizations/{organization_id}/summary")
            )
              server.config.logger.warn(
                "[numdock] The connected backend does not expose the account API. Restart the NumDock backend from this checkout and verify API_INTERNAL_URL.",
              );
          } catch {
            server.config.logger.warn(
              "[numdock] Cannot verify the backend contract. Start the NumDock backend and verify API_INTERNAL_URL.",
            );
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    devPortFallbackNotice(),
    checkBackendContract(),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./app", import.meta.url)) } },
  server: {
    port: 3000,
    strictPort: false,
    proxy: {
      "/v1": {
        target: process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080",
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            const origin = req.headers.origin;
            if (
              !localDevOrigin ||
              typeof origin !== "string" ||
              !isLocalhostOrigin(origin)
            ) {
              return;
            }
            // Dev-only bridge for fallback ports: the API still validates its
            // configured APP_ORIGIN, while the browser may be on 3001/3002/...
            proxyReq.setHeader("origin", devAppOrigin);
          });
        },
      },
    },
  },
});
