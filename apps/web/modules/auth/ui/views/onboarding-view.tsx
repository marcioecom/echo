"use client"

import type { MessageKey } from "@/lib/i18n"

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { cn } from "@workspace/ui/lib/utils"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { useOnboardingForm } from "@/modules/auth/hooks/use-onboarding-form"

const AVAILABILITY_STATUS = {
  checking: {
    icon: Loading03Icon,
    className: "text-muted-foreground",
    spin: true,
    message: "auth.onboarding.checking",
  },
  available: {
    icon: CheckmarkCircle02Icon,
    className: "text-primary",
    spin: false,
    message: "auth.onboarding.available",
  },
  taken: {
    icon: Alert02Icon,
    className: "text-destructive",
    spin: false,
    message: "auth.onboarding.taken",
  },
  error: {
    icon: Alert02Icon,
    className: "text-muted-foreground",
    spin: false,
    message: "auth.onboarding.checkError",
  },
} as const satisfies Record<
  string,
  {
    icon: typeof Loading03Icon
    className: string
    spin: boolean
    message: MessageKey
  }
>

export function OnboardingView() {
  const { form, onSubmit, slug, availability, markSlugTouched } =
    useOnboardingForm()
  const isPending = form.formState.isSubmitting
  const status =
    availability === "idle" ? null : AVAILABILITY_STATUS[availability]

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
                  <p
                    aria-live="polite"
                    className={cn(
                      "flex items-center gap-1.5 text-xs/relaxed",
                      status ? status.className : "text-muted-foreground"
                    )}
                  >
                    {status ? (
                      <>
                        <HugeiconsIcon
                          icon={status.icon}
                          size={13}
                          strokeWidth={1.8}
                          className={status.spin ? "animate-spin" : undefined}
                        />
                        {t(status.message, { slug })}
                      </>
                    ) : (
                      t("auth.onboarding.slugHint")
                    )}
                  </p>
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
