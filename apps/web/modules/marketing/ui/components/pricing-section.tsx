"use client"

import { Link } from "@tanstack/react-router"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

type PricingSectionProps = {
  signedIn: boolean
}

export function PricingSection({ signedIn }: PricingSectionProps) {
  const { copy } = useLanding()
  const label = signedIn ? copy.pricing.openInbox : copy.pricing.joinPilot
  const ctaClassName =
    "landing-cta inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)]"

  return (
    <section
      id="pricing"
      className="landing-section landing-band-strong scroll-mt-24"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          align="center"
          title={
            <>
              {copy.pricing.titleBefore}
              <em className="font-instrument-serif font-normal italic">
                {copy.pricing.titleEm}
              </em>
              {copy.pricing.titleAfter}
            </>
          }
          description={copy.pricing.description}
        />
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-neutral-200/90 bg-white p-8 sm:p-10">
          <p className="text-sm font-medium text-neutral-600">
            {copy.pricing.afterPilot}
          </p>
          <p className="mt-2 flex items-end gap-1">
            <span className="text-5xl font-semibold tracking-tight text-neutral-950">
              {copy.pricing.amount}
            </span>
            <span className="mb-1.5 text-neutral-600">
              {copy.pricing.period}
            </span>
          </p>
          <p className="mt-3 text-sm leading-6 text-pretty text-neutral-600">
            {copy.pricing.body}
          </p>
          <ul className="mt-8 space-y-3 text-sm text-neutral-800">
            {copy.pricing.included.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--echo-primary)]"
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col items-center gap-2.5">
            {signedIn ? (
              <Link to="/inbox" className={ctaClassName}>
                {label}
              </Link>
            ) : (
              <Link
                to="/sign-up"
                search={{ source: "pricing" }}
                className={ctaClassName}
              >
                {label}
              </Link>
            )}
            {signedIn ? null : (
              <p className="text-center text-sm text-neutral-600">
                {copy.pricing.clickTrigger}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
