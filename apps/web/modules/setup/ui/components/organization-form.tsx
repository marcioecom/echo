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

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"

import { useOrganizationForm } from "../../hooks/use-organization-form"

export function OrganizationForm() {
  const { form, onSubmit } = useOrganizationForm()
  const isPending = form.formState.isSubmitting

  return (
    <div className="space-y-8">
      <header className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t("setup.organization.title")}
        </h1>
        <p className="max-w-prose text-base leading-7 text-pretty text-muted-foreground">
          {t("setup.organization.description")}
        </p>
      </header>

      <Form {...form}>
        <form
          className="max-w-md space-y-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">
                  {t("setup.organization.name")}
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="organization"
                    className="h-12"
                    placeholder={t("setup.organization.namePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button
            className="h-12 w-full text-base"
            disabled={isPending}
            type="submit"
          >
            {isPending
              ? t("setup.organization.submitting")
              : t("setup.organization.submit")}
          </Button>
        </form>
      </Form>

      <p className="max-w-md text-sm text-muted-foreground">
        {t("setup.organization.next")}
      </p>
    </div>
  )
}
