import { createFileRoute } from "@tanstack/react-router"

import { canManageOrganization } from "@/modules/auth/permissions"
import { InboxView } from "@/modules/inbox/ui/views/inbox-view"

export const Route = createFileRoute("/_dashboard/inbox/")({
  component: InboxIndexPage,
})

function InboxIndexPage() {
  const { workspace } = Route.useRouteContext()
  const { status } = Route.useSearch()

  return (
    <InboxView
      canManage={canManageOrganization(workspace.role)}
      organizationId={workspace.organization.id}
      selectedConversationId={null}
      status={status}
    />
  )
}
