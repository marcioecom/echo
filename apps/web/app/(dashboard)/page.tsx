import { WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { requireWorkspace } from "@/modules/auth/server/session"
import { PageHeader } from "@/modules/shell/ui/page-header"

export default async function WorkspacePage() {
  const workspace = await requireWorkspace()

  return (
    <>
      <PageHeader title="Support Inbox" />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={WhatsappIcon} size={18} strokeWidth={1.8} />
        </div>
        <h2 className="mt-4 text-sm font-medium">The inbox is on its way</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          Support Conversations from {workspace.organization.name}&apos;s
          WhatsApp Channel will land here, ready for operators to monitor,
          respond, escalate, and resolve. Shipping with LEA-14.
        </p>
      </div>
    </>
  )
}
