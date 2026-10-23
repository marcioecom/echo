import { describe, expect, it } from "vitest"

import { displayNameFromEmail } from "./display-name"

describe("displayNameFromEmail", () => {
  it("turns a dotted local part into a readable name", () => {
    expect(displayNameFromEmail("maria.silva@example.com")).toBe("Maria Silva")
  })

  it("strips digits and separator noise", () => {
    expect(displayNameFromEmail("joao_pereira99@example.com")).toBe(
      "Joao Pereira"
    )
  })

  it("normalizes case and extra separators", () => {
    expect(displayNameFromEmail("  ANA---LIMA+suporte@example.com  ")).toBe(
      "Ana Lima Suporte"
    )
  })

  it("drops diacritics so the name stays plain", () => {
    expect(displayNameFromEmail("joão.gonçalves@example.com")).toBe(
      "Joao Goncalves"
    )
  })

  it("falls back to a team name when the local part has no letters", () => {
    expect(displayNameFromEmail("12345@example.com")).toBe("Equipe")
  })
})
