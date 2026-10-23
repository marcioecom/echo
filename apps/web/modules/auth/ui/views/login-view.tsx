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
import { AuthHeader } from "@/modules/auth/ui/components/auth-header"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"
import { SocialSignIn } from "@/modules/auth/ui/components/social-sign-in"

export function LoginView() {
  const { form, onSubmit, redirectParam, redirectTo, errorKey } = useLoginForm()
  const isPending = form.formState.isSubmitting

  return (
    <div>
      <AuthHeader
        title={t("auth.login.title")}
        description={t("auth.login.description")}
      />
      {errorKey ? (
        <p className="mb-5 text-sm text-destructive" role="alert">
          {t(errorKey)}
        </p>
      ) : null}
      <SocialSignIn redirectTo={redirectTo} variant="login" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("auth.login.email")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    className="h-12"
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
                <FormLabel className="text-base">
                  {t("auth.login.password")}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    className="h-12"
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
                <Link
                  to="/forgot-password"
                  className="ml-auto block w-fit text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                >
                  {t("auth.login.forgot")}
                </Link>
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={isPending}
          >
            {isPending ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {t("auth.login.needAccount")}{" "}
            <Link
              to="/sign-up"
              search={{ redirect: redirectParam }}
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
