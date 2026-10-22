import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { workspaceReturnTo } from "./return-to";
import { useIdentity, useAuthenticate } from "@/hooks/api/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { errorMessage } from "@/lib/api/client";
import { useAuthDraftStore } from "./auth-draft-store";

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
    })
    .superRefine((value, context) => {
      if (registering && !value.name)
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "auth.validationName",
        });
    });
}

export type AuthValues = z.infer<ReturnType<typeof schema>>;

export function useAuthForm(mode: AuthMode) {
  const { t } = useTranslation();
  const registering = mode === "register";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = workspaceReturnTo(params.get("returnTo"));
  const current = useIdentity({ fresh: true });
  const errorRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema(registering)),
    defaultValues: { email: "", password: "", name: "" },
  });
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Zustand omits the persist API when browser storage is unavailable.
    void Promise.resolve(useAuthDraftStore.persist?.rehydrate())
      .then(() => {
        if (!active) return;
        const draft = useAuthDraftStore.getState();
        if (registering) {
          form.setValue("name", draft.name, { shouldDirty: false });
        }
        form.setValue("email", draft.email, { shouldDirty: false });
        setDraftReady(true);
      })
      .catch(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [form, registering]);

  useEffect(() => {
    if (!draftReady) return;
    const subscription = form.watch((values) => {
      const draft = useAuthDraftStore.getState();
      if (registering && values.name !== undefined) {
        draft.setField("name", values.name ?? "");
      }
      if (values.email !== undefined)
        draft.setField("email", values.email ?? "");
    });
    return () => subscription.unsubscribe();
  }, [draftReady, form, registering]);

  const mutation = useAuthenticate(mode, () => {
    useAuthDraftStore.getState().clear();
    void navigate(returnTo, { replace: true });
  });

  useEffect(() => {
    if (current.data && !current.isFetching && !current.isError)
      void navigate(returnTo, { replace: true });
  }, [current.data, current.isFetching, current.isError, navigate, returnTo]);
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
    draftReady,
  };
}
