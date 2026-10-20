"use client"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

export function FeaturesSection() {
  const { copy } = useLanding()

  return (
    <section
      id="features"
      className="landing-section landing-surface scroll-mt-24"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          title={
            <>
              {copy.features.titleBefore}
              <em className="font-instrument-serif font-normal italic">
                {copy.features.titleEm}
              </em>
              {copy.features.titleAfter}
            </>
          }
          description={copy.features.description}
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-200/90 sm:grid-cols-2">
          {copy.features.items.map((feature) => (
            <article key={feature.title} className="bg-white p-6 sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight">
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
