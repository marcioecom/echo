import { describe, expect, it } from "vitest"
import { z } from "zod"

import { authMessages } from "@/modules/auth/i18n"
import { inboxMessages } from "@/modules/inbox/i18n"
import { knowledgeMessages } from "@/modules/knowledge-base/i18n"
import { membersMessages } from "@/modules/organization/i18n"
import { shellMessages } from "@/modules/shell/i18n"

import { isMessageKey, resolveLocale, t, translateMessage } from "./i18n"

const catalogs = [
  authMessages,
  inboxMessages,
  knowledgeMessages,
  membersMessages,
  shellMessages,
]

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

  it("fills placeholders without translating the inserted value", () => {
    expect(t("inbox.description", { name: "Acme" })).toBe(
      "WhatsApp conversations for Acme."
    )
    expect(t("members.description", { name: "Acme" })).toBe(
      "People with a Membership in Acme. Invitations are the only way to join."
    )
  })

  it("keeps Portuguese catalogs aligned with English", () => {
    for (const messages of catalogs) {
      expect(leafKeys(messages["pt-BR"]).sort()).toEqual(
        leafKeys(messages.en).sort()
      )
    }
  })

  it("follows the lang cookie when the document is available", () => {
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "lang=pt-br" },
    })
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { language: "en" },
    })

    try {
      expect(t("inbox.title")).toBe("Inbox de suporte")
      expect(t("auth.login.submit")).toBe("Entrar")
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      })
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      })
    }
  })
})

function leafKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return []
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof entry === "string" ? [path] : leafKeys(entry, path)
  })
}
