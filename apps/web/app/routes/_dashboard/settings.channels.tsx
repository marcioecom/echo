import { createFileRoute, redirect } from "@tanstack/react-router"

import { canManageOrganization } from "@/modules/auth/permissions"
import { channelsHead } from "@/modules/channels/head"
import { ChannelsView } from "@/modules/channels/ui/views/channels-view"

export const Route = createFileRoute("/_dashboard/settings/channels")({
  beforeLoad: ({ context }) => {
    if (!canManageOrganization(context.workspace.role)) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: ChannelsPage,
  head: () => channelsHead(),
})

function ChannelsPage() {
  const { workspace } = Route.useRouteContext()

  return (
    <div className="mx-auto max-w-3xl">
      <ChannelsView organizationId={workspace.organization.id} />
    </div>
  )
}
