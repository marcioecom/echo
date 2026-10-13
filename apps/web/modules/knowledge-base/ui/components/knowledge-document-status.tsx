import { cn } from "@workspace/ui/lib/utils"

import { t, type MessageKey } from "@/lib/i18n"

import type { KnowledgeDocumentStatus } from "../../types"

const statusKeys = {
  pending: "knowledge.status.pending",
  processing: "knowledge.status.processing",
  ready: "knowledge.status.ready",
  failed: "knowledge.status.failed",
} as const satisfies Record<KnowledgeDocumentStatus, MessageKey>

export function KnowledgeDocumentStatusBadge({
  status,
}: {
  status: KnowledgeDocumentStatus
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "ready" && "bg-primary/10 text-primary",
        status === "failed" && "bg-destructive/10 text-destructive",
        (status === "pending" || status === "processing") &&
          "bg-muted text-muted-foreground"
      )}
    >
      {t(statusKeys[status])}
    </span>
  )
}
