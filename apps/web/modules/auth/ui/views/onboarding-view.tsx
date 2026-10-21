"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { useOnboardingForm } from "@/modules/auth/hooks/use-onboarding-form"
import { SlugAvailabilityStatus } from "@/modules/organization/ui/components/slug-availability"

export function OnboardingView() {
  const { form, onSubmit, slug, availability, markSlugTouched } =
    useOnboardingForm()
  const isPending = form.formState.isSubmitting

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.onboarding.title")}</CardTitle>
        <CardDescription>{t("auth.onboarding.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.onboarding.name")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      placeholder={t("auth.onboarding.namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.onboarding.slug")}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t("auth.onboarding.slugPlaceholder")}
                      className="font-mono"
                      {...field}
                      onChange={(event) => {
                        markSlugTouched()
                        field.onChange(event)
                      }}
                    />
                  </FormControl>
                  {form.formState.errors.slug ? null : (
                    <SlugAvailabilityStatus
                      availability={availability}
                      slug={slug}
                    />
                  )}
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || availability === "taken"}
            >
              {isPending
                ? t("auth.onboarding.submitting")
                : t("auth.onboarding.submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
