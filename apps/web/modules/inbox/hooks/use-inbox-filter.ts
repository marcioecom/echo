"use client"

import type { InboxStatusFilter } from "../types"

import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

import { track } from "@/lib/analytics"

export function useInboxFilter(organizationId: string) {
  const navigate = useNavigate()

  return useCallback(
    (filter: InboxStatusFilter) => {
      void track("inbox_filter_applied", { organizationId, filter })
      navigate({ to: ".", search: { status: filter } })
    },
    [navigate, organizationId]
  )
}
