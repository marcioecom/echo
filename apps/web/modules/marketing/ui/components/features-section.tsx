import {
  BookOpen01Icon,
  InboxIcon,
  HelpCircleIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SectionHeading } from "./section-heading"

const features = [
  {
    icon: BookOpen01Icon,
    title: "Answers from your knowledge base",
    body: "Echo replies to written questions using the documents you upload. If it is not in your knowledge, it does not make up a policy.",
  },
  {
    icon: HelpCircleIcon,
    title: "Asks a clarifying question when unsure",
    body: "When a request is incomplete, Echo asks one clear question instead of guessing the service, the date, or the address.",
  },
  {
    icon: UserMultiple02Icon,
    title: "Hands off to a human",
    body: "Care, exceptions, and anything Echo should not answer go to a teammate — with the thread so far still visible.",
  },
  {
    icon: InboxIcon,
    title: "One web inbox for the team",
    body: "WhatsApp conversations land in a shared inbox. The next person can read what happened and continue.",
  },
]

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="landing-section scroll-mt-24 bg-[oklch(0.99_0.01_220)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          title={
            <>
              What Echo{" "}
              <em className="font-instrument-serif font-normal italic">
                actually
              </em>{" "}
              does
            </>
          }
          description="Four things, on purpose. Audio, photos, and stickers go to a human. There is no scheduling, no broadcasts, and no third-party integrations."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_10px_30px_oklch(0.4_0.03_230_/_0.04)] sm:p-8"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-[oklch(0.96_0.02_220)] text-neutral-800">
                <HugeiconsIcon
                  icon={feature.icon}
                  size={18}
                  strokeWidth={1.8}
                />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-[46ch] text-sm leading-6 text-pretty text-neutral-600">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
