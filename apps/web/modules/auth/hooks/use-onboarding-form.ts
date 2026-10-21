"use client"

import { useNavigateAfterAuth } from "@/modules/auth/hooks/use-navigate-after-auth"
import { useCreateOrganizationForm } from "@/modules/organization/hooks/use-create-organization-form"

export function useOnboardingForm() {
  const navigateAfterAuth = useNavigateAfterAuth()

  return useCreateOrganizationForm({
    onCreated: () => navigateAfterAuth("/inbox"),
  })
}
