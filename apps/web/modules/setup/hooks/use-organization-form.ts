"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { deriveSlug, SLUG_MAX_LENGTH } from "@workspace/domain"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"

const organizationSchema = z.object({
  name: z.string().min(1, "setup.organization.errors.name"),
})

export type OrganizationFormValues = z.infer<typeof organizationSchema>

/**
 * First-run variant of the Organization form: one visible field. The slug is an
 * internal address, so it is derived from the name and retried on collision
 * instead of being asked of the person who is only trying to start.
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

async function createOrganization(name: string) {
  for (const slug of slugCandidates(name)) {
    const { data, error } = await authClient.organization.create({ name, slug })
    if (!error && data) return data
    if (!slugIsTaken(error)) return null
  }
  return null
}

function slugCandidates(name: string): string[] {
  const base = deriveSlug(name) || "organizacao"
  return [
    base,
    ...["2", "3", "4", "5"].map((suffix) => withSuffix(base, suffix)),
    withSuffix(base, Math.random().toString(36).slice(2, 6)),
  ]
}

function withSuffix(base: string, suffix: string): string {
  const room = SLUG_MAX_LENGTH - suffix.length - 1
  return `${base.slice(0, room).replace(/-+$/, "")}-${suffix}`
}

function slugIsTaken(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined
  return (
    code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
    code === "ORGANIZATION_ALREADY_EXISTS"
  )
}
