import { createFileRoute } from "@tanstack/react-router"

import { InboxView } from "@/modules/inbox/ui/views/inbox-view"

export const Route = createFileRoute("/_dashboard/inbox/")({
  component: InboxIndexPage,
})

function InboxIndexPage() {
  const { workspace } = Route.useRouteContext()
  const { status } = Route.useSearch()

  return (
    <InboxView
      organizationId={workspace.organization.id}
      selectedConversationId={null}
      status={status}
    />
  )
}

