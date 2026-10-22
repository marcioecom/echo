"use client"

import type { Workspace } from "@/modules/auth/session"

import { useEffect } from "react"

import { groupOrganization, identifyUser } from "@/lib/analytics"

export function useAnalyticsIdentity(workspace: Workspace | null) {
  const userId = workspace?.user.id ?? null
  const organizationId = workspace?.organization.id ?? null
  const organizationName = workspace?.organization.name ?? null

  useEffect(() => {
    if (!userId) return
    void identifyUser(userId)
  }, [userId])

  useEffect(() => {
    if (!organizationId) return
    void groupOrganization(
      organizationId,
      organizationName ? { name: organizationName } : {}
    )
  }, [organizationId, organizationName])
}
