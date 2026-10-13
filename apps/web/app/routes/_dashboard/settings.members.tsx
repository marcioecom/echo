import { createFileRoute } from "@tanstack/react-router"

import { membersHead } from "@/modules/organization/head"
import { MembersView } from "@/modules/organization/ui/views/members-view"

export const Route = createFileRoute("/_dashboard/settings/members")({
  component: MembersPage,
  head: () => membersHead(),
})

function MembersPage() {
  const { workspace } = Route.useRouteContext()

  return (
    <div className="mx-auto max-w-2xl">
      <MembersView
        currentRole={workspace.role}
        organizationName={workspace.organization.name}
      />
    </div>
  )
}
