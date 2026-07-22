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
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useOnboardingForm } from "@/modules/auth/hooks/use-onboarding-form"

const AVAILABILITY_STATUS = {
  checking: {
    icon: Loading03Icon,
    className: "text-muted-foreground",
    spin: true,
    text: (slug: string) => `Checking ${slug}...`,
  },
  available: {
    icon: CheckmarkCircle02Icon,
    className: "text-primary",
    spin: false,
    text: (slug: string) => `${slug} is available`,
  },
  taken: {
    icon: Alert02Icon,
    className: "text-destructive",
    spin: false,
    text: (slug: string) => `${slug} is taken. Try another one`,
  },
  error: {
    icon: Alert02Icon,
    className: "text-muted-foreground",
    spin: false,
    text: () => "Could not check availability. It will be verified on submit",
  },
} as const

export function OnboardingView() {
  const { form, onSubmit, slug, availability, markSlugTouched } =
    useOnboardingForm()
  const isPending = form.formState.isSubmitting
  const status =
    availability === "idle" ? null : AVAILABILITY_STATUS[availability]

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Create your organization</CardTitle>
        <CardDescription>
          Your organization is the tenant that holds your support workspace.
          To join an existing one instead, open the link from your invitation
          email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      placeholder="Acme Support"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="acme-support"
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
                        {status.text(slug)}
                      </>
                    ) : (
                      "URL-safe identifier. Lowercase letters, numbers, and hyphens."
                    )}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || availability === "taken"}
            >
              {isPending ? "Creating..." : "Create organization"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
