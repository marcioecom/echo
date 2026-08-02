import { cn } from "@workspace/ui/lib/utils"
import type { SupportConversationStatus } from "@workspace/domain"

const statusLabels: Record<SupportConversationStatus, string> = {
  open: "Open",
  ai_active: "AI active",
  human_required: "Human required",
  resolved: "Resolved",
}

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
      {statusLabels[status]}
    </span>
  )
}
