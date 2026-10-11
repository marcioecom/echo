import { createFileRoute } from "@tanstack/react-router"

import { MembersView } from "@/modules/organization/ui/views/members-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export const Route = createFileRoute("/_dashboard/settings/members")({
  component: MembersPage,
  head: () => ({
    meta: [{ title: "Members | Echo" }],
  }),
})

function MembersPage() {
  const { workspace } = Route.useRouteContext()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Members"
        description={`People with a Membership in ${workspace.organization.name}. Invitations are the only way to join.`}
      />
      <MembersView currentRole={workspace.role} />
    </div>
  )
}
