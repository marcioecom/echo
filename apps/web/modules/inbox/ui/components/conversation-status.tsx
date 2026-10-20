import type { MessageKey } from "@/lib/i18n"
import type { SupportConversationStatus } from "@workspace/domain"

import {
  BotIcon,
  CheckmarkCircle02Icon,
  Message01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

import { t } from "@/lib/i18n"

const statusKeys = {
  open: "inbox.status.open",
  ai_active: "inbox.status.ai_active",
  human_required: "inbox.status.human_required",
  resolved: "inbox.status.resolved",
} as const satisfies Record<SupportConversationStatus, MessageKey>

const statusIcons = {
  open: Message01Icon,
  ai_active: BotIcon,
  human_required: UserIcon,
  resolved: CheckmarkCircle02Icon,
} as const

export function ConversationStatus({
  status,
}: {
  status: SupportConversationStatus
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "human_required" && "bg-warning/20 text-warning-foreground",
        status === "resolved" && "bg-primary/10 text-primary",
        status === "ai_active" && "bg-primary/10 text-primary",
        status === "open" && "bg-muted text-muted-foreground"
      )}
    >
      <HugeiconsIcon
        aria-hidden
        icon={statusIcons[status]}
        size={12}
        strokeWidth={1.8}
      />
      {t(statusKeys[status])}
    </span>
  )
}
