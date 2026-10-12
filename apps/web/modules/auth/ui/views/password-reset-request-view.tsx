"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Link } from "@tanstack/react-router"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { usePasswordResetRequestForm } from "@/modules/auth/hooks/use-password-reset-request-form"

export function PasswordResetRequestView() {
  const { form, isSubmitted, onSubmit } = usePasswordResetRequestForm()
  const isPending = form.formState.isSubmitting

  if (isSubmitted) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("auth.resetRequest.sentTitle")}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {t("auth.resetRequest.sentBody")}
          </p>
        </header>
        <Link
          to="/login"
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t("auth.resetRequest.back")}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.resetRequest.title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("auth.resetRequest.description")}
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.resetRequest.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("auth.resetRequest.emailPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? t("auth.resetRequest.submitting")
              : t("auth.resetRequest.submit")}
          </Button>
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {t("auth.resetRequest.remembered")}{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("auth.resetRequest.signIn")}
            </Link>
          </p>
        </form>
      </Form>
    </div>
  )
}
