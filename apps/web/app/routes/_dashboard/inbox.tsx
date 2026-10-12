import { createFileRoute, Outlet } from "@tanstack/react-router"

import { inboxHead } from "@/modules/inbox/head"
import { inboxSearchSchema } from "@/modules/inbox/search"

export const Route = createFileRoute("/_dashboard/inbox")({
  validateSearch: inboxSearchSchema,
  // Layout only: /inbox and /inbox/$conversationId are children and need Outlet.
  component: InboxLayout,
  head: () => inboxHead(),
})

function InboxLayout() {
  return <Outlet />
}
