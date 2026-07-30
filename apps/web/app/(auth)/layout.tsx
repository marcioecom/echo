import { BrandLogo } from "@/components/brand-logo"
import { WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(30rem,0.9fr)]">
      <aside className="hidden min-h-svh flex-col border-r bg-sidebar p-10 lg:flex xl:p-14">
        <BrandLogo priority imageClassName="h-9 w-auto" />
        <div className="my-auto max-w-xl py-12">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <HugeiconsIcon icon={WhatsappIcon} size={17} strokeWidth={1.8} />
            WhatsApp customer support
          </p>
          <h1 className="mt-5 max-w-md text-4xl font-semibold tracking-[-0.035em] text-balance xl:text-5xl">
            Keep every customer conversation in reach.
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-pretty text-muted-foreground">
            Echo gives your team a focused place to follow support, use AI with
            care, and step in when a person is needed.
          </p>
          <AuthInboxPreview />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          A private workspace for teams invited to Echo.
        </p>
      </aside>

      <main className="flex min-w-0 flex-col px-6 py-5 sm:px-10 sm:py-8 lg:px-14 xl:px-20">
        <div className="flex h-11 items-center justify-between lg:justify-end">
          <BrandLogo
            priority
            className="lg:hidden"
            imageClassName="h-7 w-auto"
          />
          <Link
            href="/"
            className="inline-flex h-11 items-center text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            Back to home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-12 sm:py-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  )
}

function AuthInboxPreview() {
  return (
    <div className="mt-10 overflow-hidden rounded-xl border bg-card">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <HugeiconsIcon icon={WhatsappIcon} size={15} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-medium">Support Inbox</p>
            <p className="text-[11px] text-muted-foreground">WhatsApp</p>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          AI active
        </span>
      </div>
      <div className="grid grid-cols-[40%_60%]">
        <div className="border-r bg-sidebar p-2">
          <PreviewConversation
            active
            name="Marina Costa"
            message="Could you help me with my order?"
          />
          <PreviewConversation
            name="Lucas Almeida"
            message="Thank you, that worked."
          />
          <PreviewConversation
            name="Ana Ribeiro"
            message="I need to change my delivery address."
          />
        </div>
        <div className="flex min-w-0 flex-col p-4">
          <div className="border-b pb-3">
            <p className="text-sm font-medium">Marina Costa</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Needs a reply
            </p>
          </div>
          <div className="flex min-h-40 flex-1 flex-col justify-end gap-3 py-4 text-xs leading-5">
            <p className="max-w-[85%] rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Hi, could you help me with my order? I have not received an
              update.
            </p>
            <p className="ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground">
              I&apos;ll check the latest status for you now.
            </p>
          </div>
          <div className="flex h-9 items-center rounded-md border px-3 text-xs text-muted-foreground">
            Reply to Marina...
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewConversation({
  active = false,
  name,
  message,
}: {
  active?: boolean
  name: string
  message: string
}) {
  return (
    <div
      className={`rounded-md px-2.5 py-2 ${active ? "bg-sidebar-accent" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium">{name}</p>
        {active ? (
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
