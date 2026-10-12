import { describe, expect, it } from "vitest"
import { z } from "zod"

import { isMessageKey, resolveLocale, translateMessage } from "./i18n"

describe("app i18n", () => {
  it("resolves the language cookie before the browser language", () => {
    expect(resolveLocale({ cookie: "lang=pt-br", language: "en" })).toBe(
      "pt-BR"
    )
    expect(resolveLocale({ cookie: "lang=en", language: "pt-BR" })).toBe("en")
    expect(resolveLocale({ language: "pt-BR" })).toBe("pt-BR")
    expect(resolveLocale({})).toBe("en")
  })

  it("keeps Zod message keys and translates them when the field renders", () => {
    const schema = z.string().min(1, "channels.validation.displayName")
    const issue = schema.safeParse("").error?.issues[0]

    expect(issue?.message).toBe("channels.validation.displayName")
    expect(isMessageKey(issue?.message ?? "")).toBe(true)
    expect(translateMessage("channels.validation.displayName")).toBe(
      "Enter a name."
    )
    expect(translateMessage("not a key")).toBe("not a key")
  })
})
