import { describe, expect, it } from "vitest"

import { ac, admin, operator, owner } from "./permissions"

describe("organization roles", () => {
  it("gives the owner full organization control", () => {
    expect(owner.authorize({ organization: ["update", "delete"] }).success).toBe(
      true,
    )
    expect(
      owner.authorize({ member: ["create", "update", "delete"] }).success,
    ).toBe(true)
    expect(owner.authorize({ invitation: ["create", "cancel"] }).success).toBe(
      true,
    )
  })

  it("keeps organization deletion away from the admin", () => {
    expect(admin.authorize({ organization: ["update"] }).success).toBe(true)
    expect(admin.authorize({ organization: ["delete"] }).success).toBe(false)
    expect(
      admin.authorize({ member: ["create", "update", "delete"] }).success,
    ).toBe(true)
  })

  it("gives the operator no organization management permissions", () => {
    expect(operator.authorize({ organization: ["update"] }).success).toBe(false)
    expect(operator.authorize({ member: ["create"] }).success).toBe(false)
    expect(operator.authorize({ invitation: ["create"] }).success).toBe(false)
  })

  it("keeps the operator at member-level access-control read", () => {
    expect(operator.authorize({ ac: ["read"] }).success).toBe(true)
    expect(operator.authorize({ ac: ["delete"] }).success).toBe(false)
    expect(ac.newRole).toBeTypeOf("function")
  })
})
