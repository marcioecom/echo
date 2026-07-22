"use client"

import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { BrandLogo } from "@/components/brand-logo"
import { AppSidebar } from "@/modules/shell/ui/app-sidebar"

type AppShellProps = {
  organizationId: string
  organizationName: string
  userName: string
  userRole: string
  children: React.ReactNode
}

export function AppShell({
  organizationId,
  organizationName,
  userName,
  userRole,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const [lastPathname, setLastPathname] = useState(pathname)
  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (!sidebarOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [sidebarOpen])

  const sidebarProps = { organizationId, organizationName, userName, userRole }

  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-60 border-r border-sidebar-border md:block">
        <AppSidebar {...sidebarProps} organizationSwitcherSide="right" />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-(--z-overlay) md:hidden">
          <div
            aria-hidden
            className="animate-in fade-in duration-150 absolute inset-0 bg-foreground/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="animate-in slide-in-from-left duration-200 absolute inset-y-0 left-0 w-60 border-r border-sidebar-border">
            <AppSidebar {...sidebarProps} organizationSwitcherSide="bottom" />
          </aside>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="absolute top-3.5 left-64 flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.8} />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-svh min-w-0 flex-col md:pl-60">
        <header className="sticky top-0 z-(--z-sticky) flex h-12 items-center gap-2 border-b bg-background px-4 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <HugeiconsIcon icon={Menu01Icon} size={16} strokeWidth={1.8} />
          </button>
          <BrandLogo variant="compact" imageClassName="h-6 w-auto" />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
