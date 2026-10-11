import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import {
  sessionQueryOptions,
  workspaceQueryOptions,
} from "@/modules/auth/queries"
import { AppShell } from "@/modules/shell/ui/app-shell"

export const Route = createFileRoute("/_dashboard")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions()
    )
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      })
    }

    const workspace = await context.queryClient.ensureQueryData(
      workspaceQueryOptions()
    )
    if (!workspace) {
      throw redirect({ to: "/onboarding" })
    }

    return { workspace }
  },
  pendingComponent: DashboardPending,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions())
  if (!workspace) return null

  return (
    <AppShell
      organizationId={workspace.organization.id}
      organizationName={workspace.organization.name}
      userName={workspace.user.name}
      userRole={workspace.role}
    >
      <Outlet />
    </AppShell>
  )
}

function DashboardPending() {
  return (
    <div
      aria-label="Loading workspace"
      className="flex min-h-svh bg-background"
    >
      <div className="hidden w-60 border-r bg-sidebar md:block" />
      <div className="flex-1 animate-pulse px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 h-7 w-48 rounded bg-muted" />
        <div className="h-96 rounded-lg border bg-muted/40" />
      </div>
    </div>
  )
}
