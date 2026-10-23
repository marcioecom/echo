import { describe, expect, it } from "vitest"

import { suggestEmailDomain } from "./email-typo"

describe("suggestEmailDomain", () => {
  it("returns null for a valid provider domain", () => {
    expect(suggestEmailDomain("maria@gmail.com")).toBeNull()
    expect(suggestEmailDomain("maria@hotmail.com")).toBeNull()
    expect(suggestEmailDomain("maria@outlook.com")).toBeNull()
    expect(suggestEmailDomain("maria@yahoo.com")).toBeNull()
    expect(suggestEmailDomain("maria@icloud.com")).toBeNull()
  })

  it("corrects common typos of known providers", () => {
    expect(suggestEmailDomain("maria@gmial.com")).toBe("maria@gmail.com")
    expect(suggestEmailDomain("maria@gmai.com")).toBe("maria@gmail.com")
    expect(suggestEmailDomain("maria@gmail.con")).toBe("maria@gmail.com")
    expect(suggestEmailDomain("maria@hotmal.com")).toBe("maria@hotmail.com")
    expect(suggestEmailDomain("maria@outlok.com")).toBe("maria@outlook.com")
    expect(suggestEmailDomain("maria@yaho.com")).toBe("maria@yahoo.com")
    expect(suggestEmailDomain("maria@icloud.co")).toBe("maria@icloud.com")
  })

  it("keeps the local part untouched", () => {
    expect(suggestEmailDomain("Maria.Silva@gmial.com")).toBe(
      "Maria.Silva@gmail.com"
    )
    expect(suggestEmailDomain("maria+echo@gmai.com")).toBe(
      "maria+echo@gmail.com"
    )
  })

  it("matches the domain case-insensitively and trims whitespace", () => {
    expect(suggestEmailDomain("  maria@GMIAL.COM  ")).toBe("maria@gmail.com")
  })

  it("returns null when there is no usable address", () => {
    expect(suggestEmailDomain("")).toBeNull()
    expect(suggestEmailDomain("maria")).toBeNull()
    expect(suggestEmailDomain("@gmail.com")).toBeNull()
    expect(suggestEmailDomain("maria@")).toBeNull()
  })

  it("leaves legitimate domains one edit away from a provider alone", () => {
    expect(suggestEmailDomain("maria@mail.com")).toBeNull()
    expect(suggestEmailDomain("maria@example.com")).toBeNull()
  })
})
