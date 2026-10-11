import { createFileRoute } from "@tanstack/react-router"

import { inboxSearchSchema } from "@/modules/inbox/search"
import { InboxView } from "@/modules/inbox/ui/views/inbox-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export const Route = createFileRoute("/_dashboard/inbox")({
  validateSearch: inboxSearchSchema,
  component: InboxPage,
  head: () => ({
    meta: [{ title: "Support Inbox | Echo" }],
  }),
})

function InboxPage() {
  const { workspace } = Route.useRouteContext()
  const { status } = Route.useSearch()

  return (
    <>
      <PageHeader
        title="Support Inbox"
        description={`WhatsApp conversations for ${workspace.organization.name}.`}
      />
      <InboxView
        organizationId={workspace.organization.id}
        selectedConversationId={null}
        status={status}
      />
    </>
  )
}
