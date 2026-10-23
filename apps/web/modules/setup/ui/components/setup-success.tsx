"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"

export function SetupSuccess({
  contactName,
  conversationId,
  echoAnswered,
}: {
  contactName: string
  conversationId: string
  echoAnswered: boolean
}) {
  const recap = [
    t("setup.success.recap.organization"),
    t("setup.success.recap.channel"),
    t("setup.success.recap.conversation"),
  ]

  return (
    <section aria-live="polite" className="space-y-6">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon
          aria-hidden
          icon={Tick02Icon}
          size={22}
          strokeWidth={2}
        />
      </span>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("setup.success.title")}
        </h1>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {echoAnswered
            ? t("setup.success.body", { name: contactName })
            : t("setup.success.bodyNoReply", { name: contactName })}
        </p>
      </div>

      <ul className="space-y-2 border-y border-border py-4">
        {recap.map((line) => (
          <li className="flex items-center gap-2 text-sm" key={line}>
            <HugeiconsIcon
              aria-hidden
              className="text-primary"
              icon={Tick02Icon}
              size={14}
              strokeWidth={2}
            />
            {line}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button asChild>
          <Link
            params={{ conversationId }}
            search={{ status: "all" }}
            to="/inbox/$conversationId"
          >
            {t("setup.success.conversation")}
          </Link>
        </Button>
        <Link
          className="text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30"
          to="/inbox"
        >
          {t("setup.success.inbox")}
        </Link>
      </div>
    </section>
  )
}
