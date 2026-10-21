"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { deriveSlug, SLUG_MAX_LENGTH, SLUG_PATTERN } from "@workspace/domain"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

const organizationSchema = z.object({
  name: z.string().min(1, "organization.validation.name"),
  slug: z
    .string()
    .min(1, "organization.validation.slug")
    .max(SLUG_MAX_LENGTH, "organization.validation.slugMax")
    .regex(SLUG_PATTERN, "organization.validation.slugPattern"),
})

export type OrganizationFormValues = z.infer<typeof organizationSchema>

export type SlugAvailability =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "error"

export type CreatedOrganization = {
  id: string
  name: string
  slug: string
}

type UseCreateOrganizationFormOptions = {
  onCreated: (organization: CreatedOrganization) => void | Promise<void>
}

function isTakenSlugError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
  )
}

export function useCreateOrganizationForm({
  onCreated,
}: UseCreateOrganizationFormOptions) {
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: "", slug: "" },
  })

  const [slugTouched, setSlugTouched] = useState(false)
  const [availability, setAvailability] = useState<SlugAvailability>("idle")
  const checkId = useRef(0)

  const name = useWatch({ control: form.control, name: "name" })
  const slug = useWatch({ control: form.control, name: "slug" })

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", deriveSlug(name ?? ""))
    }
  }, [name, slugTouched, form])

  const slugValid = !!slug && SLUG_PATTERN.test(slug)
  const [lastSlug, setLastSlug] = useState(slug)
  if (lastSlug !== slug) {
    setLastSlug(slug)
    setAvailability(slugValid ? "checking" : "idle")
  }

  useEffect(() => {
    if (!slugValid) return
    const id = ++checkId.current
    const timer = setTimeout(async () => {
      const { data, error } = await authClient.organization.checkSlug({ slug })
      if (id !== checkId.current) return
      if (error) {
        setAvailability(isTakenSlugError(error) ? "taken" : "error")
        return
      }
      setAvailability(data?.status === true ? "available" : "taken")
    }, 350)
    return () => clearTimeout(timer)
  }, [slug, slugValid])

  async function onSubmit(values: OrganizationFormValues) {
    const { data: slugAvailability, error: slugError } =
      await authClient.organization.checkSlug({ slug: values.slug })
    if (slugError) {
      form.setError("slug", {
        message: isTakenSlugError(slugError)
          ? "organization.validation.slugTaken"
          : "organization.validation.slugCheck",
      })
      setAvailability(isTakenSlugError(slugError) ? "taken" : "error")
      return
    }
    if (slugAvailability?.status !== true) {
      form.setError("slug", {
        message: "organization.validation.slugTaken",
      })
      setAvailability("taken")
      return
    }
    const { data, error } = await authClient.organization.create({
      name: values.name,
      slug: values.slug,
    })
    if (error || !data) {
      form.setError("slug", {
        message: error?.message ?? "organization.validation.create",
      })
      return
    }
    await onCreated({ id: data.id, name: data.name, slug: data.slug })
  }

  function resetForm() {
    setSlugTouched(false)
    setAvailability("idle")
    form.reset({ name: "", slug: "" })
  }

  return {
    form,
    onSubmit,
    slug,
    availability,
    markSlugTouched: () => setSlugTouched(true),
    resetForm,
  }
}
