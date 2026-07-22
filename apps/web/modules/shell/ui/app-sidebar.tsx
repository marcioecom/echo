"use client"

import { cn } from "@workspace/ui/lib/utils"
import {
  InboxIcon,
  Logout01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { BrandLogo } from "@/components/brand-logo"
import { SignOutButton } from "@/modules/auth/ui/components/sign-out-button"
import { OrganizationSwitcher } from "@/modules/shell/ui/organization-switcher"

type AppSidebarProps = {
  organizationId: string
  organizationName: string
  userName: string
  userRole: string
  organizationSwitcherSide?: "bottom" | "right"
}

const NAV_SECTIONS: {
  label?: string
  items: { href: string; label: string; icon: typeof InboxIcon; exact?: boolean }[]
}[] = [
  {
    items: [
      { href: "/", label: "Support Inbox", icon: InboxIcon, exact: true },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/members", label: "Members", icon: UserMultiple02Icon },
    ],
  },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function AppSidebar({
  organizationId,
  organizationName,
  userName,
  userRole,
  organizationSwitcherSide,
}: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-13 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <BrandLogo
          variant="mark"
          className="rounded-md"
          imageClassName="h-6 w-6"
        />
        <OrganizationSwitcher
          activeOrganizationId={organizationId}
          activeOrganizationName={organizationName}
          side={organizationSwitcherSide}
        />
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section, index) => (
          <div key={section.label ?? index} className="space-y-0.5">
            {section.label ? (
              <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors duration-150",
                    "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={15}
                    strokeWidth={1.8}
                    className={cn(
                      "shrink-0",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-sidebar-border p-3">
        <div
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
        >
          {initials(userName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{userName}</p>
          <p className="truncate text-[11px] text-muted-foreground capitalize">
            {userRole}
          </p>
        </div>
        <SignOutButton
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          className="text-muted-foreground"
        >
          <HugeiconsIcon icon={Logout01Icon} size={14} strokeWidth={1.8} />
        </SignOutButton>
      </div>
    </div>
  )
}
