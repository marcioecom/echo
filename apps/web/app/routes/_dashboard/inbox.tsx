import { createFileRoute, Outlet } from "@tanstack/react-router"

import { inboxSearchSchema } from "@/modules/inbox/search"
import { PageHeader } from "@/modules/shell/ui/page-header"

export const Route = createFileRoute("/_dashboard/inbox")({
  validateSearch: inboxSearchSchema,
  // Layout only: /inbox and /inbox/$conversationId are children and need Outlet.
  component: InboxLayout,
  head: () => ({
    meta: [{ title: "Support Inbox | Echo" }],
  }),
})

function InboxLayout() {
  const { workspace } = Route.useRouteContext()

  return (
    <>
      <PageHeader
        title="Support Inbox"
        description={`WhatsApp conversations for ${workspace.organization.name}.`}
      />
      <Outlet />
    </>
  )
}
