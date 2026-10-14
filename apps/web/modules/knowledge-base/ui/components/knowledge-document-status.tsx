import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

import { t, type MessageKey } from "@/lib/i18n"

import type { KnowledgeDocumentStatus } from "../../types"

const statusKeys = {
  pending: "knowledge.status.pending",
  processing: "knowledge.status.processing",
  ready: "knowledge.status.ready",
  failed: "knowledge.status.failed",
} as const satisfies Record<KnowledgeDocumentStatus, MessageKey>

const statusIcons = {
  pending: Clock01Icon,
  processing: Loading03Icon,
  ready: CheckmarkCircle02Icon,
  failed: Alert02Icon,
} as const

export function KnowledgeDocumentStatusBadge({
  status,
}: {
  status: KnowledgeDocumentStatus
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "ready" && "bg-primary/10 text-primary",
        status === "failed" && "bg-destructive/10 text-destructive",
        (status === "pending" || status === "processing") &&
          "bg-muted text-muted-foreground"
      )}
    >
      <HugeiconsIcon
        aria-hidden
        className={cn(status === "processing" && "animate-spin")}
        icon={statusIcons[status]}
        size={12}
        strokeWidth={1.8}
      />
      {t(statusKeys[status])}
    </span>
  )
}
