import type { KnowledgeDocument } from "./types"
import type { MessageKey } from "@/lib/i18n"

import { t } from "@/lib/i18n"

const failureKeys: Record<string, MessageKey> = {
  index_dispatch_failed: "knowledge.failure.index_dispatch_failed",
  indexing_failed: "knowledge.failure.indexing_failed",
  no_text_extracted: "knowledge.failure.no_text_extracted",
}

export function knowledgeFailureMessage(reason: string | null): string | null {
  if (!reason) return null
  return t(failureKeys[reason] ?? "knowledge.failure.unknown")
}

export function knowledgeSourceLabel(
  document: Pick<KnowledgeDocument, "sourceType" | "sourceName">
): string {
  return document.sourceType === "file"
    ? (document.sourceName ?? t("knowledge.file"))
    : t("knowledge.pastedText")
}
