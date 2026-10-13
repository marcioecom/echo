import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { knowledgeDocumentDetailPath } from "./hooks/api"
import { knowledgeFailureMessage } from "./labels"

const moduleDir = dirname(fileURLToPath(import.meta.url))

describe("knowledge document detail", () => {
  it("builds an org-scoped detail path with a chunk page", () => {
    expect(knowledgeDocumentDetailPath("01K1EDN69NFBWCG42B2H99V2C4", 2)).toBe(
      "/v1/knowledge-documents/01K1EDN69NFBWCG42B2H99V2C4?page=2"
    )
  })

  it("translates failure reasons, including a scanned PDF", () => {
    expect(knowledgeFailureMessage("indexing_failed")).toBe("Indexing failed.")
    expect(knowledgeFailureMessage("no_text_extracted")).toBe(
      "PDF has no text: is it scanned?"
    )
    expect(knowledgeFailureMessage(null)).toBeNull()

    const previousDocument = globalThis.document
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "lang=pt-br" },
    })
    try {
      expect(knowledgeFailureMessage("no_text_extracted")).toBe(
        "PDF sem texto: é escaneado?"
      )
      expect(knowledgeFailureMessage("index_dispatch_failed")).toBe(
        "Não foi possível iniciar a indexação."
      )
      expect(knowledgeFailureMessage("indexing_failed")).toBe(
        "A indexação falhou."
      )
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      })
    }
  })

  it("opens the detail drawer from the document list", () => {
    const list = readFileSync(
      join(moduleDir, "ui/components/knowledge-document-list.tsx"),
      "utf8"
    )
    const drawer = readFileSync(
      join(moduleDir, "ui/components/knowledge-document-drawer.tsx"),
      "utf8"
    )
    const form = readFileSync(
      join(moduleDir, "ui/components/knowledge-document-form.tsx"),
      "utf8"
    )
    const formHook = readFileSync(
      join(moduleDir, "hooks/use-knowledge-document-form.ts"),
      "utf8"
    )
    const view = readFileSync(
      join(moduleDir, "ui/views/knowledge-base-view.tsx"),
      "utf8"
    )
    const route = readFileSync(
      join(moduleDir, "../../app/routes/_dashboard/settings.knowledge.tsx"),
      "utf8"
    )
    const head = readFileSync(join(moduleDir, "head.ts"), "utf8")
    const hook = readFileSync(
      join(moduleDir, "hooks/use-knowledge-document-detail.ts"),
      "utf8"
    )

    expect(list).toContain("useKnowledgeDocuments")
    expect(list).toContain("<KnowledgeDocumentDrawer")
    expect(list).toContain('t("knowledge.detail.open"')
    expect(drawer).toContain("useKnowledgeDocumentDetail")
    expect(drawer).toContain('t("knowledge.detail.contentTab")')
    expect(drawer).toContain('t("knowledge.detail.chunksTab")')
    expect(drawer).not.toContain("void ")
    expect(hook).not.toContain("void ")
    expect(form).toContain("useKnowledgeDocumentForm")
    expect(form).toContain("<TranslatedFormMessage")
    expect(formHook).toContain("knowledge.validation.title")
    expect(formHook).toContain("knowledge.validation.content")
    expect(formHook).toContain("knowledge.validation.file")
    expect(view).toContain("<KnowledgeDocumentForm")
    expect(view).toContain("<KnowledgeDocumentList")
    expect(view).not.toContain("useKnowledgeDocumentForm")
    expect(view).not.toContain("document.title")
    expect(route).toContain("knowledgeHead()")
    expect(head).toContain('t("knowledge.metaTitle")')
  })
})
