import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@workspace/domain"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createOrganization, slugCandidates } from "./create-organization"

const { create } = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { create } },
}))

describe("slugCandidates", () => {
  it("starts from the derived slug and adds collision fallbacks", () => {
    const candidates = slugCandidates("Padaria do Bairro")

    expect(candidates[0]).toBe("padaria-do-bairro")
    expect(candidates.length).toBeGreaterThan(1)
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it("keeps every candidate a valid slug", () => {
    for (const slug of slugCandidates("Açúcar & Cia.")) {
      expect(slug).toMatch(SLUG_PATTERN)
      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    }
  })

  it("falls back to a default slug when the name has no slug characters", () => {
    expect(slugCandidates("!!!")[0]).toBe("organizacao")
  })

  it("caps long names without leaving a trailing dash", () => {
    const [base] = slugCandidates(`acme ${"long".repeat(30)}`)
    expect(base?.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(base?.endsWith("-")).toBe(false)

    const [, suffixed] = slugCandidates(`acme ${"long".repeat(30)}`)
    expect(suffixed?.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(suffixed?.endsWith("-")).toBe(false)
    expect(suffixed).toMatch(SLUG_PATTERN)
  })
})

describe("createOrganization", () => {
  beforeEach(() => {
    create.mockReset()
  })

  it("creates the Organization with the derived slug", async () => {
    create.mockResolvedValue({ data: { id: "org" }, error: null })

    await expect(createOrganization("Bluebird Bakery")).resolves.toEqual({
      id: "org",
    })
    expect(create).toHaveBeenCalledWith({
      name: "Bluebird Bakery",
      slug: "bluebird-bakery",
    })
  })

  it("retries with a suffix when the slug is already taken", async () => {
    create
      .mockResolvedValueOnce({
        data: null,
        error: { code: "ORGANIZATION_SLUG_ALREADY_TAKEN" },
      })
      .mockResolvedValueOnce({ data: { id: "org" }, error: null })

    await expect(createOrganization("Bluebird Bakery")).resolves.toEqual({
      id: "org",
    })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1]?.[0].slug).toBe("bluebird-bakery-2")
  })

  it("gives up on errors that are not about the slug", async () => {
    create.mockResolvedValue({
      data: null,
      error: { code: "SOMETHING_ELSE" },
    })

    await expect(createOrganization("Bluebird Bakery")).resolves.toBeNull()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("returns null once every candidate is taken", async () => {
    create.mockResolvedValue({
      data: null,
      error: { code: "ORGANIZATION_SLUG_ALREADY_TAKEN" },
    })

    await expect(createOrganization("Bluebird Bakery")).resolves.toBeNull()
    expect(create).toHaveBeenCalledTimes(
      slugCandidates("Bluebird Bakery").length
    )
  })
})
