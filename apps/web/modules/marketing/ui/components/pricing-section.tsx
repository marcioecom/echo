import { Link } from "@tanstack/react-router"

import { SectionHeading } from "./section-heading"

const included = [
  "Answers from your knowledge base",
  "Clarifying questions when Echo is unsure",
  "Human handoff, including audio, photos, and stickers",
  "One web inbox for your team",
]

type PricingSectionProps = {
  signedIn: boolean
}

export function PricingSection({ signedIn }: PricingSectionProps) {
  const href = signedIn ? "/inbox" : "/sign-up"
  const label = signedIn ? "Open inbox" : "Join the pilot"

  return (
    <section
      id="pricing"
      className="landing-section scroll-mt-24 bg-[oklch(0.96_0.028_220)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          align="center"
          title={
            <>
              Start with a{" "}
              <em className="font-instrument-serif font-normal italic">
                pilot
              </em>
            </>
          }
          description="Echo is early. The pilot is free for 30 days, with a limited number of spots, so we can stay close to each business."
        />
        <div className="mx-auto mt-12 max-w-lg rounded-[2rem] border border-white/80 bg-white/75 p-8 shadow-[0_20px_50px_oklch(0.4_0.04_230_/_0.08)] backdrop-blur-xl sm:p-10">
          <p className="text-sm font-medium text-neutral-600">
            After the pilot
          </p>
          <p className="mt-2 flex items-end gap-1">
            <span className="text-5xl font-semibold tracking-tight text-neutral-950">
              R$297
            </span>
            <span className="mb-1.5 text-neutral-600">/month</span>
          </p>
          <p className="mt-3 text-sm leading-6 text-pretty text-neutral-600">
            First 30 days free. Then from R$297 per month. No extra product
            tiers, and no “talk to sales” maze.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-neutral-800">
            {included.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-950"
                />
                {item}
              </li>
            ))}
          </ul>
          <Link
            to={href}
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-neutral-950 px-7 text-sm font-medium text-white outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/35"
          >
            {label}
          </Link>
        </div>
      </div>
    </section>
  )
}
