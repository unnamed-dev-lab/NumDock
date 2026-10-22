import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateEvents } from "./cache";
export function useAccountEvents(org: string, enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!org || !enabled) return;
    const stream = new EventSource(
      "/v1/organizations/" + encodeURIComponent(org) + "/events/stream",
    );
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      invalidateEvents(client, org, pending);
      pending.clear();
    };
    stream.onmessage = (message) => {
      try {
        const event: unknown = JSON.parse(message.data);
        if (
          typeof event === "object" &&
          event !== null &&
          "type" in event &&
          typeof event.type === "string"
        ) {
          pending.add(event.type);
          timer ??= setTimeout(flush, 40);
        }
      } catch {
        /* Ignore malformed events; a reconnect and later valid event can recover. */
      }
    };
    return () => {
      stream.close();
      if (timer) clearTimeout(timer);
    };
  }, [org, enabled, client]);
}
