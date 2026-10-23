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
import { usePasswordResetRequestForm } from "@/modules/auth/hooks/use-password-reset-request-form"
import { AuthHeader } from "@/modules/auth/ui/components/auth-header"

export function PasswordResetRequestView() {
  const { form, isSubmitted, onSubmit } = usePasswordResetRequestForm()
  const isPending = form.formState.isSubmitting

  if (isSubmitted) {
    return (
      <div>
        <AuthHeader
          title={t("auth.resetRequest.sentTitle")}
          description={t("auth.resetRequest.sentBody")}
        />
        <Link
          to="/login"
          className="inline-flex h-11 items-center text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t("auth.resetRequest.back")}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <AuthHeader
        title={t("auth.resetRequest.title")}
        description={t("auth.resetRequest.description")}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("auth.resetRequest.email")}
                </FormLabel>
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
          <Button
            type="submit"
            className="w-full text-base"
            disabled={isPending}
          >
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
