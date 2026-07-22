"use client"

import {
  ArrowDown01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { useState } from "react"

import { useOrganizationSwitcher } from "@/modules/shell/hooks/use-organization-switcher"

type OrganizationSwitcherProps = {
  activeOrganizationId: string
  activeOrganizationName: string
  side?: "bottom" | "right"
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function OrganizationSwitcher({
  activeOrganizationId,
  activeOrganizationName,
  side = "right",
}: OrganizationSwitcherProps) {
  const [open, setOpen] = useState(false)
  const {
    organizations,
    isError,
    isLoading,
    isSwitching,
    switchingOrganizationId,
    refetch,
    switchOrganization,
  } = useOrganizationSwitcher(activeOrganizationId)

  async function handleOrganizationSelect(organizationId: string) {
    const switched = await switchOrganization(organizationId)
    if (switched) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Switch organization. Current organization: ${activeOrganizationName}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold tracking-tight outline-none transition-colors duration-150 hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/30"
        >
          <span className="truncate">{activeOrganizationName}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-muted-foreground"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        className={cn(
          "z-(--z-modal) rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
          side === "bottom" ? "w-52" : "w-68"
        )}
      >
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Organizations
        </p>
        {isLoading ? (
          <div className="space-y-1 p-1" aria-label="Loading organizations">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-sm bg-muted"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-2 px-2 py-3">
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t load organizations.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Try again
            </button>
          </div>
        ) : organizations.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No organizations found.
          </p>
        ) : (
          <ul aria-label="Organizations" className="space-y-0.5">
            {organizations.map((organization) => {
              const active = organization.id === activeOrganizationId
              const switching = switchingOrganizationId === organization.id
              return (
                <li key={organization.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    disabled={active || isSwitching}
                    onClick={() => handleOrganizationSelect(organization.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none transition-colors duration-150",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
                      "disabled:pointer-events-none"
                    )}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(organization.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {organization.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {organization.slug}
                      </span>
                    </span>
                    {switching ? (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={14}
                        strokeWidth={1.8}
                        className="animate-spin text-muted-foreground"
                      />
                    ) : active ? (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        size={14}
                        strokeWidth={2}
                        className="text-primary"
                      />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
