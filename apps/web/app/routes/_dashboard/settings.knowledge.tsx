import { createFileRoute, redirect } from "@tanstack/react-router"

import { canManageOrganization } from "@/modules/auth/permissions"
import { KnowledgeBaseView } from "@/modules/knowledge-base/ui/views/knowledge-base-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export const Route = createFileRoute("/_dashboard/settings/knowledge")({
  beforeLoad: ({ context }) => {
    if (!canManageOrganization(context.workspace.role)) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: KnowledgePage,
  head: () => ({
    meta: [{ title: "Knowledge Base | Echo" }],
  }),
})

function KnowledgePage() {
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
