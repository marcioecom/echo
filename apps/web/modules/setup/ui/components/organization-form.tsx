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
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-balance">
          {t("setup.organization.title")}
        </h1>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {t("setup.organization.description")}
        </p>
      </header>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("setup.organization.name")}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="organization"
                    placeholder={t("setup.organization.namePlaceholder")}
                    {...field}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
          <Button disabled={isPending} type="submit">
            {isPending
              ? t("setup.organization.submitting")
              : t("setup.organization.submit")}
          </Button>
        </form>
      </Form>

      <p className="text-xs text-muted-foreground">
        {t("setup.organization.next")}
      </p>
    </div>
  )
}
