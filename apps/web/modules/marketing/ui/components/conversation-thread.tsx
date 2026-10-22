import { BookOpen01Icon, InboxIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

export type ChatLine = {
  from: "customer" | "echo"
  text: string
  /** Document the answer came from, shown as a citation inside the bubble. */
  source?: string
}

type ConversationThreadProps = {
  business: string
  channel: string
  messages: ChatLine[]
  handoff?: { name: string; note: string } | null
  /**
   * `plain` sits directly on the hero sky. `panel` is the framed version
   * used inside a section band. `hero` is the framed version used in the
   * hero, aligned with the knowledge panel.
   */
  variant?: "plain" | "panel" | "hero"
  messagesClassName?: string
  className?: string
}

export function ConversationThread({
  business,
  channel,
  messages,
  handoff = null,
  variant = "plain",
  messagesClassName,
  className,
}: ConversationThreadProps) {
  const panel = variant === "panel"
  const hero = variant === "hero"

  return (
    <figure
      className={cn(
        "flex w-full max-w-[23rem] flex-col",
        panel &&
          "max-w-[24rem] rounded-2xl border border-neutral-200/80 bg-white p-5 sm:p-6",
        hero &&
          "overflow-hidden rounded-2xl border border-black/[0.08] bg-white",
        className
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3",
          panel && "border-b border-neutral-200/70 pb-4",
          hero && "border-b border-black/[0.06] px-4 py-3"
        )}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--echo-green-100)] text-[13px] font-medium text-[var(--echo-green-800)] ring-1 ring-black/5"
        >
          {business.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] leading-5 font-medium text-neutral-900">
            {business}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] leading-4 text-neutral-600">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-[var(--echo-green-500)]"
            />
            {channel}
          </p>
        </div>
      </header>

      <div className={cn("flex flex-col gap-2 pt-5", messagesClassName)}>
        {messages.map((message) => (
          <p
            key={message.text}
            className={cn(
              "thread-bubble max-w-[86%] rounded-[14px] px-3 py-1.5 text-[13px] leading-[1.45]",
              message.from === "customer"
                ? "self-end rounded-br-[4px] bg-[#dcf8c6] text-neutral-900"
                : "self-start rounded-bl-[4px] border border-black/[0.07] bg-white text-neutral-800"
            )}
          >
            {message.text}
            {message.source ? (
              <span className="mt-1 flex items-center gap-1 border-t border-black/[0.06] pt-1 text-[10px] leading-4 text-neutral-500">
                <HugeiconsIcon
                  icon={BookOpen01Icon}
                  size={10}
                  strokeWidth={1.8}
                  aria-hidden
                />
                {message.source}
              </span>
            ) : null}
          </p>
        ))}

        {handoff ? (
          <p className="thread-bubble mt-1 flex items-center gap-2 self-start rounded-full border border-black/[0.07] bg-white/85 px-2.5 py-1.5 text-[11px] leading-4 text-neutral-700">
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--echo-green-700)] text-[9px] font-medium text-white"
            >
              {handoff.name.slice(0, 1)}
            </span>
            <span>
              <span className="font-medium text-neutral-900">
                {handoff.name}
              </span>{" "}
              {handoff.note}
            </span>
            <HugeiconsIcon
              icon={InboxIcon}
              size={12}
              strokeWidth={1.8}
              className="shrink-0 text-neutral-500"
              aria-hidden
            />
          </p>
        ) : null}
      </div>
    </figure>
  )
}
