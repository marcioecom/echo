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
import { Input } from "@workspace/ui/components/input"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { useLoginForm } from "@/modules/auth/hooks/use-login-form"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"

export function LoginView() {
  const { form, onSubmit } = useLoginForm()
  const isPending = form.formState.isSubmitting

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.login.title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("auth.login.description")}
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.login.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("auth.login.emailPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.login.password")}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <TranslatedFormMessage />
                <Link
                  to="/forgot-password"
                  className="ml-auto block w-fit text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                >
                  {t("auth.login.forgot")}
                </Link>
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {t("auth.login.needAccount")}{" "}
            <Link
              to="/sign-up"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("auth.login.createOne")}
            </Link>
          </p>
        </form>
      </Form>
    </div>
  )
}
