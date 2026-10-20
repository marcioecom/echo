"use client"

import type { LandingCopy, Locale } from "./dictionary"
import type { ReactNode } from "react"

import { createContext, useContext } from "react"

import { dictionary } from "./dictionary"

type LandingContextValue = {
  locale: Locale
  copy: LandingCopy
}

const LandingContext = createContext<LandingContextValue | null>(null)

export function LandingProvider({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  return (
    <LandingContext.Provider value={{ locale, copy: dictionary[locale] }}>
      {children}
    </LandingContext.Provider>
  )
}

export function useLanding() {
  const value = useContext(LandingContext)

  if (!value) {
    throw new Error("useLanding must be used within LandingProvider")
  }

  return value
}
