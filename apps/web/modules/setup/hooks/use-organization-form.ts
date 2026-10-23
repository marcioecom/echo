"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"
import { createOrganization } from "@/modules/organization/lib/create-organization"

const organizationSchema = z.object({
  name: z.string().min(1, "setup.organization.errors.name"),
})

export type OrganizationFormValues = z.infer<typeof organizationSchema>

/**
 * The slug rules live in the shared createOrganization helper.
 */
export function useOrganizationForm() {
  const navigateAfterAuth = useNavigateAfterAuth()

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(values: OrganizationFormValues) {
    const created = await createOrganization(values.name)
    if (!created) {
      form.setError("name", { message: "setup.organization.errors.create" })
      return
    }
    await navigateAfterAuth("/setup")
  }

  return { form, onSubmit }
}
