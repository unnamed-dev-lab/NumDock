import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, ApiError, csrfHeaders, identityQuery } from "@/lib/api/client";

export function useWorkspace() {
  const identity = useQuery(identityQuery);
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: async () => {
      const result = await api.POST("/v1/auth/logout", {
        params: { header: await csrfHeaders() },
      });
      if (!result.response.ok && result.response.status !== 401) {
        throw new ApiError(
          result.response.status,
          result.error?.code ?? "request_failed",
          result.error?.message ?? "Could not sign out. Please try again.",
        );
      }
    },
    onSuccess: () => {
      client.clear();
      void navigate("/login", { replace: true });
    },
  });

  return {
    identity,
    logout,
    unauthenticated:
      identity.error instanceof ApiError && identity.error.status === 401,
  };
}
