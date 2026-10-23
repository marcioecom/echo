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
import { useSignUpForm } from "@/modules/auth/hooks/use-sign-up-form"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"
import { SocialSignIn } from "@/modules/auth/ui/components/social-sign-in"

export function SignUpView() {
  const { form, onSubmit, redirectTo } = useSignUpForm()
  const isPending = form.formState.isSubmitting

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.signUp.title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t("auth.signUp.description")}
        </p>
      </header>
      <SocialSignIn redirectTo={redirectTo} variant="signup" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.signUp.name")}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder={t("auth.signUp.namePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.signUp.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("auth.signUp.emailPlaceholder")}
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
                <FormLabel>{t("auth.signUp.password")}</FormLabel>
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
                <FormLabel>{t("auth.signUp.confirmPassword")}</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("auth.signUp.submitting") : t("auth.signUp.submit")}
          </Button>
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {t("auth.signUp.haveAccount")}{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("auth.signUp.signIn")}
            </Link>
          </p>
        </form>
      </Form>
    </div>
  )
}
