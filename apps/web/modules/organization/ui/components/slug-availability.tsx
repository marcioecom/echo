"use client"

import type { MessageKey } from "@/lib/i18n"
import type { SlugAvailability } from "@/modules/organization/hooks/use-create-organization-form"

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

import { t } from "@/lib/i18n"

const AVAILABILITY_STATUS = {
  checking: {
    icon: Loading03Icon,
    className: "text-muted-foreground",
    spin: true,
    message: "organization.checking",
  },
  available: {
    icon: CheckmarkCircle02Icon,
    className: "text-primary",
    spin: false,
    message: "organization.available",
  },
  taken: {
    icon: Alert02Icon,
    className: "text-destructive",
    spin: false,
    message: "organization.taken",
  },
  error: {
    icon: Alert02Icon,
    className: "text-muted-foreground",
    spin: false,
    message: "organization.checkError",
  },
} as const satisfies Record<
  string,
  {
    icon: typeof Loading03Icon
    className: string
    spin: boolean
    message: MessageKey
  }
>

type SlugAvailabilityStatusProps = {
  availability: SlugAvailability
  slug: string
  className?: string
}

export function SlugAvailabilityStatus({
  availability,
  slug,
  className,
}: SlugAvailabilityStatusProps) {
  const status =
    availability === "idle" ? null : AVAILABILITY_STATUS[availability]

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex items-start gap-1.5 text-xs/relaxed",
        status ? status.className : "text-muted-foreground",
        className
      )}
    >
      {status ? (
        <>
          <HugeiconsIcon
            icon={status.icon}
            size={13}
            strokeWidth={1.8}
            aria-hidden
            className={cn(
              "mt-px shrink-0",
              status.spin && "animate-spin motion-reduce:animate-none"
            )}
          />
          {t(status.message, { slug })}
        </>
      ) : (
        t("organization.slugHint")
      )}
    </p>
  )
}
