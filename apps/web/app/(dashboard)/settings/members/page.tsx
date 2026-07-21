import { requireWorkspace } from "@/modules/auth/server/session"
import { MembersView } from "@/modules/organization/ui/views/members-view"

export default async function MembersPage() {
  const workspace = await requireWorkspace()

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-medium">Members</h1>
      <MembersView currentRole={workspace.role} />
    </div>
  )
}
