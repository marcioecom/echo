"use client"

import { useEffect } from "react"

import { capturePageview } from "@/lib/analytics"

export function useAnalyticsRouteTracking(pathname: string) {
  useEffect(() => {
    void capturePageview(pathname)
  }, [pathname])
}
