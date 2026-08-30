import { redirect } from "next/navigation"

import { canManageOrganization } from "@/modules/auth/permissions"
import { requireWorkspace } from "@/modules/auth/server/session"
import { KnowledgeBaseView } from "@/modules/knowledge-base/ui/views/knowledge-base-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export default async function KnowledgePage() {
  const workspace = await requireWorkspace()
  if (!canManageOrganization(workspace.role)) redirect("/inbox")

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Knowledge Base"
        description="Support information Echo can use in first responses."
      />
      <KnowledgeBaseView />
    </div>
  )
}
