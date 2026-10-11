"use client"

import { Link } from "@tanstack/react-router"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

type FinalCtaProps = {
  signedIn: boolean
}

export function FinalCta({ signedIn }: FinalCtaProps) {
  const { copy } = useLanding()
  const href = signedIn ? "/inbox" : "/sign-up"
  const label = signedIn ? copy.finalCta.openInbox : copy.finalCta.joinPilot

  return (
    <section className="landing-section landing-deep px-5 py-20 text-center sm:px-8 md:py-28">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
          {copy.finalCta.titleBefore}
          <em className="font-instrument-serif font-normal italic">
            {copy.finalCta.titleEm}
          </em>
          {copy.finalCta.titleAfter}
        </h2>
        <p className="mx-auto mt-5 max-w-[42ch] text-base leading-7 text-pretty text-white/80">
          {copy.finalCta.body}
        </p>
        <Link
          to={href}
          className="landing-cta-on-dark mt-8 inline-flex h-12 items-center rounded-full px-7 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {label}
        </Link>
      </div>
    </section>
  )
}
