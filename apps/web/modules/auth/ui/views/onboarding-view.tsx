"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"

import { useOnboardingForm } from "@/modules/auth/hooks/use-onboarding-form"

export function OnboardingView() {
  const { form, onSubmit, slug } = useOnboardingForm()
  const isPending = form.formState.isSubmitting

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-medium">Create your organization</h1>
          <p className="text-sm text-muted-foreground">
            Your organization is the tenant that holds your support workspace.
            To join an existing one instead, open the link from your invitation
            email.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  {slug ? (
                    <p className="text-xs text-muted-foreground">
                      Slug: <span className="font-mono">{slug}</span>
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Creating..." : "Create organization"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
