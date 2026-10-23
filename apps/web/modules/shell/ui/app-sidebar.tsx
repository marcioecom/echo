"use client"

import {
  BookOpen01Icon,
  InboxIcon,
  SmartPhone01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"

import { BrandLogo } from "@/components/brand-logo"
import { t } from "@/lib/i18n"
import { canManageOrganization } from "@/modules/auth/permissions"
import { AccountMenu } from "@/modules/shell/ui/account-menu"
import { OrganizationSwitcher } from "@/modules/shell/ui/organization-switcher"

type AppSidebarProps = {
  organizationId: string
  organizationName: string
  userName: string
  userEmail: string
  userRole: string
  organizationSwitcherSide?: "bottom" | "right"
}

const NAV_ITEMS = [
  {
    items: [
      { href: "/inbox", label: "inbox.nav", icon: InboxIcon, exact: true },
    ],
  },
  {
    label: "shell.settings",
    items: [
      {
        href: "/settings/members",
        label: "members.nav",
        icon: UserMultiple02Icon,
      },
      {
        href: "/settings/channels",
        label: "channels.nav",
        icon: SmartPhone01Icon,
        requiresManage: true,
      },
      {
        href: "/settings/knowledge",
        label: "knowledge.nav",
        icon: BookOpen01Icon,
        requiresManage: true,
      },
    ],
  },
] as const

export function AppSidebar({
  organizationId,
  organizationName,
  userName,
  userEmail,
  userRole,
  organizationSwitcherSide,
}: AppSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const navSections = NAV_ITEMS.map((section) => ({
    label: "label" in section ? t(section.label) : undefined,
    items: section.items
      .filter(
        (item) =>
          !("requiresManage" in item) ||
          !item.requiresManage ||
          canManageOrganization(userRole)
      )
      .map((item) => ({ ...item, label: t(item.label) })),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
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

      <nav
        aria-label={t("shell.primaryNav")}
        className="flex-1 space-y-5 overflow-y-auto p-3"
      >
        {navSections.map((section, index) => (
          <div key={section.label ?? index} className="space-y-0.5">
            {section.label ? (
              <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const active =
                "exact" in item && item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  to={
                    item.href as
                      | "/inbox"
                      | "/settings/members"
                      | "/settings/channels"
                      | "/settings/knowledge"
                  }
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 outline-none",
                    "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={16}
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

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <AccountMenu
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
        />
      </div>
    </div>
  )
}
