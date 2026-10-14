"use client"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

export function HowItWorksSection() {
  const { copy } = useLanding()

  return (
    <section
      id="how-it-works"
      className="landing-section landing-band scroll-mt-24"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          title={
            <>
              {copy.how.titleBefore}
              <em className="font-instrument-serif font-normal italic">
                {copy.how.titleEm}
              </em>
              {copy.how.titleAfter}
            </>
          }
          description={copy.how.description}
        />
        <ol className="mt-14 grid gap-6 lg:grid-cols-3">
          {copy.how.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-neutral-200/70 bg-white p-6 sm:p-8"
            >
              <span className="font-instrument-serif text-4xl text-neutral-500 italic">
                0{index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-balance">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-pretty text-neutral-600">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
