import { createFileRoute, redirect } from "@tanstack/react-router"

import { canManageOrganization } from "@/modules/auth/permissions"
import { setupHead } from "@/modules/setup/head"
import { OrganizationForm } from "@/modules/setup/ui/components/organization-form"
import { SetupView } from "@/modules/setup/ui/views/setup-view"

export const Route = createFileRoute("/_setup/setup")({
  head: () => setupHead(),
  beforeLoad: ({ context }) => {
    // An Operator joins an Organization that someone else configured. There is
    // nothing for them to set up, so send them to the work instead of a form.
    if (context.workspace && !canManageOrganization(context.workspace.role)) {
      throw redirect({ to: "/inbox" })
    }
  },
  component: SetupPage,
})

function SetupPage() {
  const { workspace } = Route.useRouteContext()

  if (!workspace) return <OrganizationForm />

  return <SetupView canManage organizationId={workspace.organization.id} />
}
