import { BrandLogo } from "@/components/brand-logo"
import { getSession } from "@/modules/auth/server/session"
import { LandingHero } from "@/modules/marketing/ui/components/landing-hero"
import { LandingNav } from "@/modules/marketing/ui/components/landing-nav"

import "../hero.css"

const workflow = [
  {
    id: "inbox",
    title: "One web inbox for your team",
    description:
      "WhatsApp support conversations land in a shared inbox, so the next person can see what happened and continue from there.",
  },
  {
    id: "knowledge",
    title: "Answers from your knowledge base",
    description:
      "Echo replies to straightforward written questions using the documents you upload. It does not invent policies that are not in your knowledge.",
  },
  {
    id: "handoff",
    title: "A person when it needs one",
    description:
      "When a conversation needs care — or when a customer sends audio — Echo hands off to a teammate instead of guessing.",
  },
]

export async function HomeView() {
  const session = await getSession()
  const signedIn = Boolean(session)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#how-it-works"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-(--z-tooltip) focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-950 focus:shadow"
      >
        Skip to how it works
      </a>
      <LandingNav signedIn={signedIn} />

      <main>
        <LandingHero signedIn={signedIn} />

        <section
          id="how-it-works"
          className="scroll-mt-24 border-t bg-background"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.8fr_1.2fr] md:gap-20 md:py-24">
            <div>
              <h2 className="max-w-sm text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-3xl">
                What Echo does today
              </h2>
              <p className="mt-4 max-w-[45ch] text-sm leading-6 text-pretty text-muted-foreground">
                Echo is early. It answers from your knowledge base, hands off to
                a human when it should, and keeps the work in one web inbox.
              </p>
            </div>
            <ol className="border-t">
              {workflow.map((step, index) => (
                <li
                  key={step.id}
                  id={step.id}
                  className="grid scroll-mt-28 grid-cols-[2.5rem_1fr] gap-4 border-b py-5 sm:grid-cols-[3.5rem_1fr] sm:gap-6"
                >
                  <span className="pt-0.5 text-sm font-medium text-primary tabular-nums">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-medium">{step.title}</h3>
                    <p className="mt-1.5 max-w-[58ch] text-sm leading-6 text-pretty text-muted-foreground">
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
            WhatsApp customer support that answers from your knowledge and
            brings in a person when it needs to.
          </p>
        </div>
        <p className="max-w-md text-xs leading-5 text-muted-foreground sm:text-right">
          Echo is in a private pilot. If you do not recognize Echo, do not enter
          your details. Contact the person or organization that invited you.
        </p>
      </footer>
    </div>
  )
}
