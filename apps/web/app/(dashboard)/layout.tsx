import { requireWorkspace } from "@/modules/auth/server/session"
import { AppShell } from "@/modules/shell/ui/app-shell"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const workspace = await requireWorkspace()

  return (
    <AppShell
      organizationName={workspace.organization.name}
      userName={workspace.user.name}
      userRole={workspace.role}
    >
      {children}
    </AppShell>
  )
}
