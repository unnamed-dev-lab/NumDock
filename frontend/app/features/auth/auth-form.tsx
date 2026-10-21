import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input, type InputProps } from "@/components/motion/input";
import { useAuthForm, type AuthMode, type AuthValues } from "./use-auth-form";
import { isTranslationKey } from "@/lib/i18n/labels";

// Business adapter: RHF uses events; beUI Input exposes a string onChange API.
function AccountField({
  control,
  name,
  ...props
}: {
  control: Control<AuthValues>;
  name: keyof AuthValues;
} & Omit<
  InputProps,
  "name" | "value" | "defaultValue" | "onChange" | "error"
>) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          {...props}
          id={name}
          error={
            fieldState.error?.message
              ? t(
                  isTranslationKey(fieldState.error.message)
                    ? fieldState.error.message
                    : "errors.validationFailed",
                )
              : undefined
          }
        />
      )}
    />
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const registering = mode === "register";
  const { form, errorRef, rootError, submit, submitting, draftReady } =
    useAuthForm(mode);
  const ready = hydrated && draftReady;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-7 space-y-5"
      aria-busy={!ready || submitting}
    >
      <fieldset disabled={!ready || submitting} className="space-y-5">
        <legend className="sr-only">
          {registering ? t("auth.newAccountDetails") : t("auth.signInDetails")}
        </legend>
        {registering && (
          <>
            <AccountField
              control={form.control}
              name="name"
              label={t("auth.fullName")}
              autoComplete="name"
              maxLength={100}
              disabled={submitting}
            />
            <AccountField
              control={form.control}
              name="organization_name"
              label={t("auth.workspaceName")}
              autoComplete="organization"
              placeholder={t("auth.yourOrganization")}
              maxLength={100}
              disabled={submitting}
            />
          </>
        )}
        <AccountField
          control={form.control}
          name="email"
          label={t("auth.emailAddress")}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          placeholder="you@company.com"
          disabled={submitting}
        />
        <div className="space-y-2">
          <AccountField
            control={form.control}
            name="password"
            label={t("auth.password")}
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            disabled={submitting}
            aria-describedby={
              form.formState.errors.password
                ? "password-error"
                : registering
                  ? "password-help"
                  : undefined
            }
          />
          {registering && !form.formState.errors.password && (
            <p
              id="password-help"
              className="text-xs leading-5 text-muted-foreground"
            >
              {t("auth.useAtLeast12CharactersSpacesAnd")}
            </p>
          )}
        </div>
      </fieldset>
      {rootError && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
        >
          {rootError}
        </p>
      )}
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={!ready || submitting}
      >
        {submitting ? (
          <>
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {registering ? t("auth.creatingWorkspace") : t("auth.signingIn")}
          </>
        ) : (
          <>
            {registering ? t("auth.createWorkspace") : t("auth.signIn")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        {t("auth.draftNotice")}
      </p>
    </form>
  );
}
