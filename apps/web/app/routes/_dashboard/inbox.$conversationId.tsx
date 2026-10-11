import { createFileRoute } from "@tanstack/react-router"

import { inboxSearchSchema } from "@/modules/inbox/search"
import { InboxView } from "@/modules/inbox/ui/views/inbox-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export const Route = createFileRoute("/_dashboard/inbox/$conversationId")({
  validateSearch: inboxSearchSchema,
  component: InboxConversationPage,
  head: () => ({
    meta: [{ title: "Support Inbox | Echo" }],
  }),
})

function InboxConversationPage() {
  const { workspace } = Route.useRouteContext()
  const { conversationId } = Route.useParams()
  const { status } = Route.useSearch()

  return (
    <>
      <PageHeader
        title="Support Inbox"
        description={`WhatsApp conversations for ${workspace.organization.name}.`}
      />
      <InboxView
        organizationId={workspace.organization.id}
        selectedConversationId={conversationId}
        status={status}
      />
    </>
  )
}
