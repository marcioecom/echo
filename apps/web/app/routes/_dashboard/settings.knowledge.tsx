import { createFileRoute, redirect } from "@tanstack/react-router"

import { canManageOrganization } from "@/modules/auth/permissions"
import { knowledgeHead } from "@/modules/knowledge-base/head"
import { KnowledgeBaseView } from "@/modules/knowledge-base/ui/views/knowledge-base-view"

export const Route = createFileRoute("/_dashboard/settings/knowledge")({
  beforeLoad: ({ context }) => {
    if (!canManageOrganization(context.workspace.role)) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: KnowledgePage,
  head: () => knowledgeHead(),
})

function KnowledgePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <KnowledgeBaseView />
    </div>
  )
}
