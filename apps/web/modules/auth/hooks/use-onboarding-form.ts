"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { deriveSlug } from "@workspace/domain"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
})

type OrganizationFormValues = z.infer<typeof organizationSchema>

export function useOnboardingForm() {
  const router = useRouter()

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: "" },
  })

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

  return { form, onSubmit, slug }
}
