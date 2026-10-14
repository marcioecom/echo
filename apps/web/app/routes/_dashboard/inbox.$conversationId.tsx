import { createFileRoute } from "@tanstack/react-router"

import { InboxView } from "@/modules/inbox/ui/views/inbox-view"

export const Route = createFileRoute("/_dashboard/inbox/$conversationId")({
  component: InboxConversationPage,
})

function InboxConversationPage() {
  const { workspace } = Route.useRouteContext()
  const { conversationId } = Route.useParams()
  const { status } = Route.useSearch()

  return (
    <InboxView
      organizationId={workspace.organization.id}
      selectedConversationId={conversationId}
      status={status}
    />
  )
}
