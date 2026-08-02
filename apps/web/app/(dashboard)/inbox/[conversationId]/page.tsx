import { requireWorkspace } from "@/modules/auth/server/session"
import { InboxView } from "@/modules/inbox/ui/views/inbox-view"
import { PageHeader } from "@/modules/shell/ui/page-header"

export default async function InboxConversationPage({
  params,
}: PageProps<"/inbox/[conversationId]">) {
  const [workspace, { conversationId }] = await Promise.all([
    requireWorkspace(),
    params,
  ])

  return (
    <>
      <PageHeader
        title="Support Inbox"
        description={`WhatsApp conversations for ${workspace.organization.name}.`}
      />
      <InboxView
        organizationId={workspace.organization.id}
        selectedConversationId={conversationId}
      />
    </>
  )
}
