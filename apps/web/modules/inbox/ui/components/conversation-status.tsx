import { cn } from "@workspace/ui/lib/utils"
import type { SupportConversationStatus } from "@workspace/domain"

import { t, type MessageKey } from "@/lib/i18n"

const statusKeys = {
  open: "inbox.status.open",
  ai_active: "inbox.status.ai_active",
  human_required: "inbox.status.human_required",
  resolved: "inbox.status.resolved",
} as const satisfies Record<SupportConversationStatus, MessageKey>

export function ConversationStatus({
  status,
}: {
  status: SupportConversationStatus
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "human_required" && "bg-warning/20 text-warning-foreground",
        status === "resolved" && "bg-primary/10 text-primary",
        (status === "open" || status === "ai_active") &&
          "bg-muted text-muted-foreground"
      )}
    >
      {t(statusKeys[status])}
    </span>
  )
}
