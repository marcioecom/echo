import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { BrandLogo } from "@/components/brand-logo"
import { loadSession, loadWorkspace } from "@/modules/auth/queries"
import { SignOutButton } from "@/modules/auth/ui/components/sign-out-button"

export const Route = createFileRoute("/_setup")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const session = await loadSession(context.queryClient)
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      })
    }

    const workspace = await loadWorkspace(context.queryClient)
    return { workspace }
  },
  component: SetupLayout,
})

function SetupLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-6 sm:px-10">
        <BrandLogo imageClassName="h-7 w-auto" priority />
        <SignOutButton size="sm" variant="ghost" />
      </header>
      <main className="flex flex-1 justify-center px-6 pb-16 sm:px-10">
        <div className="w-full max-w-xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
