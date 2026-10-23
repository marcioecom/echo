"use client"

import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { usePasswordResetForm } from "@/modules/auth/hooks/use-password-reset-form"
import { AuthHeader } from "@/modules/auth/ui/components/auth-header"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"

export function PasswordResetView() {
  const { form, hasValidToken, onSubmit } = usePasswordResetForm()
  const isPending = form.formState.isSubmitting

  if (!hasValidToken) {
    return (
      <div>
        <AuthHeader
          title={t("auth.reset.invalidTitle")}
          description={t("auth.reset.invalidBody")}
        />
        <Link
          to="/forgot-password"
          className="inline-flex h-11 items-center text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t("auth.reset.requestNew")}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <AuthHeader
        title={t("auth.reset.title")}
        description={t("auth.reset.description")}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("auth.reset.password")}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-12"
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("auth.reset.confirmPassword")}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className="h-12"
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={isPending}
          >
            {isPending ? t("auth.reset.submitting") : t("auth.reset.submit")}
          </Button>
        </form>
      </Form>
    </div>
  )
}
