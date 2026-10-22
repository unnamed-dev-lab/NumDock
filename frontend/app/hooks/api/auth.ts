import { queryKeys } from "./keys";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  api,
  ApiError,
  csrfHeaders,
  unwrap,
  type Identity,
} from "@/lib/api/client";

export function useIdentity(options?: { initial?: Identity; fresh?: boolean }) {
  return useQuery({
    ...identityQuery,
    initialData: options?.initial,
    refetchOnMount: options?.fresh ? "always" : true,
  });
}
export function useAuthenticate(
  mode: "login" | "register",
  onSuccess: (identity: Identity) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      email: string;
      password: string;
      name: string;
    }) => {
      const params = { header: await csrfHeaders() };
      return mode === "register"
        ? unwrap(await api.POST("/v1/auth/register", { params, body: values }))
        : unwrap(
            await api.POST("/v1/auth/login", {
              params,
              body: { email: values.email, password: values.password },
            }),
          );
    },
    onSuccess: (identity) => {
      client.clear();
      client.setQueryData(queryKeys.identity, identity);
      onSuccess(identity);
    },
  });
}
export function useSession(initialIdentity?: Identity) {
  const identity = useIdentity({ initial: initialIdentity });
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
    unauthenticated: identity.data === null,
  };
}

export const identityQuery = queryOptions({
  queryKey: queryKeys.identity,
  queryFn: async ({ signal }) => {
    const result = await api.GET("/v1/me", { signal });
    // A confirmed anonymous session replaces any previous cached identity.
    if (result.response.status === 401) return null;
    return unwrap(result);
  },
  staleTime: 30_000,
  retry: (count, error) =>
    !(error instanceof ApiError && error.status < 500) && count < 1,
});
