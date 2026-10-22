"use client"

import { useState } from "react"

import { track } from "@/lib/analytics"

export function useChannelConnectionWizard(organizationId: string) {
  const [open, setOpen] = useState(false)

  function start() {
    if (open) return
    void track("whatsapp_connection_started", { organizationId })
    setOpen(true)
  }

  function close() {
    setOpen(false)
  }

  return { open, start, close }
}
