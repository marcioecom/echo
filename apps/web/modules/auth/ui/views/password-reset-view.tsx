"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Link } from "@tanstack/react-router"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { usePasswordResetForm } from "@/modules/auth/hooks/use-password-reset-form"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"

export function PasswordResetView() {
  const { form, hasValidToken, onSubmit } = usePasswordResetForm()
  const isPending = form.formState.isSubmitting

  if (!hasValidToken) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("auth.reset.invalidTitle")}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {t("auth.reset.invalidBody")}
          </p>
        </header>
        <Link
          to="/forgot-password"
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t("auth.reset.requestNew")}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.reset.title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("auth.reset.description")}
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.reset.password")}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
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
                <FormLabel>{t("auth.reset.confirmPassword")}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("auth.reset.submitting") : t("auth.reset.submit")}
          </Button>
        </form>
      </Form>
    </div>
  )
}
