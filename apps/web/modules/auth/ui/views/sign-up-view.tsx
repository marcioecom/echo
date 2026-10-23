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
import { suggestEmailDomain } from "@/modules/auth/email-typo"
import { useSignUpForm } from "@/modules/auth/hooks/use-sign-up-form"
import { AuthHeader } from "@/modules/auth/ui/components/auth-header"
import { PasswordInput } from "@/modules/auth/ui/components/password-input"
import { SocialSignIn } from "@/modules/auth/ui/components/social-sign-in"

export function SignUpView() {
  const {
    form,
    onSubmit,
    onFormFocus,
    redirectParam,
    redirectTo,
    source,
    isInvitation,
  } = useSignUpForm()
  const isPending = form.formState.isSubmitting
  const email = form.watch("email")
  const emailError = form.formState.errors.email
  const emailSuggestion = emailError ? null : suggestEmailDomain(email)

  return (
    <div>
      <AuthHeader
        title={t(
          isInvitation ? "auth.signUp.invitationTitle" : "auth.signUp.title"
        )}
        description={t(
          isInvitation
            ? "auth.signUp.invitationDescription"
            : "auth.signUp.description"
        )}
      />
      <SocialSignIn redirectTo={redirectTo} source={source} variant="signup" />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onFocusCapture={onFormFocus}
          className="grid gap-5"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("auth.signUp.email")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    className="h-12"
                    placeholder={t("auth.signUp.emailPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
                {emailSuggestion ? (
                  <p className="text-sm/relaxed text-muted-foreground">
                    {t("auth.signUp.emailTypoHint", { email: emailSuggestion })}{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline underline-offset-4"
                      onClick={() =>
                        form.setValue("email", emailSuggestion, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    >
                      {t("auth.signUp.emailTypoApply")}
                    </button>
                  </p>
                ) : null}
                {emailError?.message === "auth.errors.emailTaken" ? (
                  <Link
                    to="/login"
                    search={{
                      email: form.getValues("email"),
                      redirect: redirectParam,
                    }}
                    className="block w-fit text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                  >
                    {t("auth.signUp.signIn")}
                  </Link>
                ) : null}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("auth.signUp.password")}
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
            {isPending
              ? t("auth.signUp.submitting")
              : t(
                  isInvitation
                    ? "auth.signUp.invitationSubmit"
                    : "auth.signUp.submit"
                )}
          </Button>
          {isInvitation ? null : (
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.signUp.reassurance")}
            </p>
          )}
          <p className="pt-1 text-center text-sm text-muted-foreground">
            {t("auth.signUp.haveAccount")}{" "}
            <Link
              to="/login"
              search={{ redirect: redirectParam }}
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
