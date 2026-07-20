import { describe, expect, it } from "vitest"

import { deriveSlug } from "./slug"

describe("deriveSlug", () => {
  it("kebab-cases a plain name", () => {
    expect(deriveSlug("Acme Support")).toBe("acme-support")
  })

  it("strips diacritics and non-alphanumerics", () => {
    expect(deriveSlug("Açúcar & Cia.")).toBe("acucar-cia")
  })

  it("collapses repeated separators and trims dashes", () => {
    expect(deriveSlug("  --Acme---Corp--  ")).toBe("acme-corp")
  })

  it("returns an empty string for names without slug characters", () => {
    expect(deriveSlug("!!!")).toBe("")
  })

  it("caps the slug length without a trailing dash", () => {
    const slug = deriveSlug(`acme ${"long".repeat(30)}`)
    expect(slug.length).toBeLessThanOrEqual(48)
    expect(slug.endsWith("-")).toBe(false)
  })
})
