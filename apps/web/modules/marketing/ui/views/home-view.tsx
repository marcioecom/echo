import { ArrowRight01Icon, WhatsappIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

import { BrandLogo } from "@/components/brand-logo"
import { SignInButton } from "@/modules/auth/ui/components/sign-in-button"

const workflow = [
  {
    title: "Conversations arrive in one place",
    description:
      "Keep WhatsApp support requests visible instead of losing context across personal phones and group chats.",
  },
  {
    title: "AI handles the routine",
    description:
      "Echo is built to help with straightforward questions while keeping the decision to involve a person clear.",
  },
  {
    title: "People step in with context",
    description:
      "When a conversation needs care, the next person can see what happened and continue from there.",
  },
]

export function HomeView() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
        <BrandLogo priority imageClassName="h-8 w-auto sm:h-9" />
        <nav aria-label="Main navigation" className="flex items-center gap-4 sm:gap-6">
          <Link
            href="#how-it-works"
            className="hidden text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30 sm:inline"
          >
            How it works
          </Link>
          <SignInButton className="h-9 px-3.5 text-sm" />
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-12 pb-20 sm:px-8 md:grid-cols-[minmax(0,0.9fr)_minmax(23rem,1.1fr)] md:items-center md:pt-20 md:pb-28">
          <div className="max-w-xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium text-primary">
              <HugeiconsIcon icon={WhatsappIcon} size={17} strokeWidth={1.8} />
              WhatsApp customer support
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl md:text-6xl">
              Support conversations, kept clear.
            </h1>
            <p className="mt-6 max-w-[62ch] text-base leading-7 text-muted-foreground text-pretty sm:text-lg">
              Echo gives you a focused place to follow customer support on
              WhatsApp, decide when AI can help, and bring in a person when it
              matters.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                Open Echo
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                See the workflow
              </Link>
            </div>
          </div>

          <InboxPreview />
        </section>

        <section
          id="how-it-works"
          className="border-y bg-sidebar scroll-mt-6"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.8fr_1.2fr] md:gap-20 md:py-24">
            <div>
              <h2 className="max-w-sm text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-3xl">
                A quieter way to stay close to your customers.
              </h2>
              <p className="mt-4 max-w-[45ch] text-sm leading-6 text-muted-foreground text-pretty">
                Echo is a private workspace for support teams that want to keep
                their WhatsApp conversations organized without turning service
                into a complicated operation.
              </p>
            </div>
            <ol className="border-t">
              {workflow.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2.5rem_1fr] gap-4 border-b py-5 sm:grid-cols-[3.5rem_1fr] sm:gap-6"
                >
                  <span className="pt-0.5 text-sm font-medium tabular-nums text-primary">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-medium">{step.title}</h3>
                    <p className="mt-1.5 max-w-[58ch] text-sm leading-6 text-muted-foreground text-pretty">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <BrandLogo variant="compact" imageClassName="h-6 w-auto" />
          <p className="mt-3 max-w-md leading-6 text-muted-foreground">
            A private workspace for keeping WhatsApp customer support clear and
            connected.
          </p>
        </div>
        <p className="max-w-md text-xs leading-5 text-muted-foreground sm:text-right">
          If you do not recognize Echo, do not enter your details. Contact the
          person or organization that invited you.
        </p>
      </footer>
    </div>
  )
}

function InboxPreview() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_8px_8px_oklch(0.21_0.01_130_/_0.06)]">
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
      <div className="grid min-h-85 grid-cols-[42%_58%]">
        <div className="border-r bg-sidebar p-2">
          <PreviewConversation active name="Marina Costa" message="Could you help me with my order?" />
          <PreviewConversation name="Lucas Almeida" message="Thank you, that worked." />
          <PreviewConversation name="Ana Ribeiro" message="I need to change my delivery address." />
        </div>
        <div className="flex min-w-0 flex-col p-4">
          <div className="border-b pb-3">
            <p className="text-sm font-medium">Marina Costa</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Needs a reply</p>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3 py-4 text-xs leading-5">
            <p className="max-w-[85%] rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Hi, could you help me with my order? I have not received an update.
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
    <div className={`rounded-md px-2.5 py-2 ${active ? "bg-sidebar-accent" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium">{name}</p>
        {active ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
      </div>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{message}</p>
    </div>
  )
}
