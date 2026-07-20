"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { deriveSlug } from "@workspace/domain"
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
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
})

type OrganizationFormValues = z.infer<typeof organizationSchema>

export function OnboardingView() {
  const router = useRouter()

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: "" },
  })

  const isPending = form.formState.isSubmitting
  const name = useWatch({ control: form.control, name: "name" })
  const slug = deriveSlug(name ?? "")

  async function onSubmit(values: OrganizationFormValues) {
    const slug = deriveSlug(values.name)
    if (!slug) {
      form.setError("name", {
        message: "Organization name needs at least one letter or number",
      })
      return
    }
    const { data: slugAvailability, error: slugError } =
      await authClient.organization.checkSlug({ slug })
    if (slugError || slugAvailability?.status !== true) {
      toast.error(
        slugError?.message ?? "This organization name is already taken",
      )
      return
    }
    const { error } = await authClient.organization.create({
      name: values.name,
      slug,
    })
    if (error) {
      toast.error(error.message ?? "Could not create the organization")
      return
    }
    router.push("/")
  }

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
