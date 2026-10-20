import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  api,
  csrfHeaders,
  errorMessage,
  identityQuery,
  unwrap,
} from "@/lib/api/client";

export type AuthMode = "login" | "register";

function schema(registering: boolean) {
  return z
    .object({
      email: z.email("auth.validationEmail").max(254, "auth.validationEmail"),
      password: z.string().refine((value) => {
        const length = Array.from(value).length;
        return length >= 12 && length <= 128;
      }, "auth.validationPassword"),
      name: z.string().trim().max(100, "auth.validationMaxLength"),
      organization_name: z.string().trim().max(100, "auth.validationMaxLength"),
    })
    .superRefine((value, context) => {
      if (registering && !value.name)
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "auth.validationName",
        });
      if (registering && !value.organization_name)
        context.addIssue({
          code: "custom",
          path: ["organization_name"],
          message: "auth.validationWorkspace",
        });
    });
}

export type AuthValues = z.infer<ReturnType<typeof schema>>;

export function useAuthForm(mode: AuthMode) {
  const { t } = useTranslation();
  const registering = mode === "register";
  const navigate = useNavigate();
  const client = useQueryClient();
  const current = useQuery(identityQuery);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema(registering)),
    defaultValues: { email: "", password: "", name: "", organization_name: "" },
  });
  const mutation = useMutation({
    mutationFn: async (values: AuthValues) => {
      const params = { header: await csrfHeaders() };
      if (registering)
        return unwrap(
          await api.POST("/v1/auth/register", { params, body: values }),
        );
      return unwrap(
        await api.POST("/v1/auth/login", {
          params,
          body: { email: values.email, password: values.password },
        }),
      );
    },
    onSuccess: (identity) => {
      client.clear();
      client.setQueryData(identityQuery.queryKey, identity);
      void navigate("/app", { replace: true });
    },
  });

  useEffect(() => {
    if (current.data) void navigate("/app", { replace: true });
  }, [current.data, navigate]);
  const rootError = form.formState.errors.root
    ? errorMessage(mutation.error, t)
    : undefined;
  useEffect(() => {
    if (rootError) errorRef.current?.focus();
  }, [rootError]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch {
      form.setError("root", { message: "errors.requestFailed" });
    }
  });

  return {
    form,
    errorRef,
    rootError,
    submit,
    submitting: form.formState.isSubmitting,
  };
}
