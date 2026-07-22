import { requireWorkspace } from "@/modules/auth/server/session"
import { MembersView } from "@/modules/organization/ui/views/members-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export default async function MembersPage() {
  const workspace = await requireWorkspace()

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
