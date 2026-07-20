import Link from "next/link"

import { requireWorkspace } from "@/modules/auth/server/session"
import { SignOutButton } from "@/modules/auth/ui/components/sign-out-button"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const workspace = await requireWorkspace()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold">
            Echo
          </Link>
          <span className="text-sm text-muted-foreground">
            {workspace.organization.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/settings/members"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Members
          </Link>
          <div className="text-right">
            <p className="text-sm">{workspace.user.name}</p>
            <p className="text-xs text-muted-foreground">{workspace.role}</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
