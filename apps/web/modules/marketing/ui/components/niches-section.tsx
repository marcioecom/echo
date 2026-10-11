"use client"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

export function NichesSection() {
  const { copy } = useLanding()

  return (
    <section
      id="businesses"
      className="landing-section landing-surface scroll-mt-24"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          title={
            <>
              {copy.niches.titleBefore}
              <em className="font-instrument-serif font-normal italic">
                {copy.niches.titleEm}
              </em>
              {copy.niches.titleAfter}
            </>
          }
          description={copy.niches.description}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.niches.items.map((niche) => (
            <li
              key={niche.name}
              className="rounded-3xl border border-neutral-200/80 bg-white px-6 py-7"
            >
              <h3 className="font-instrument-serif text-2xl italic">
                {niche.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-pretty text-neutral-600">
                {niche.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
