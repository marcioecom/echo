"use client"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

export function FaqSection() {
  const { copy } = useLanding()

  return (
    <section id="faq" className="landing-section landing-surface scroll-mt-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-28">
        <SectionHeading
          title={
            <>
              {copy.faq.titleBefore}
              <em className="font-instrument-serif font-normal italic">
                {copy.faq.titleEm}
              </em>
              {copy.faq.titleAfter}
            </>
          }
          description={copy.faq.description}
        />
        <div className="border-t border-neutral-200">
          {copy.faq.items.map((faq) => (
            <details
              key={faq.question}
              className="group border-b border-neutral-200"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium text-neutral-950 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span
                  aria-hidden
                  className="text-xl leading-none text-neutral-600 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[58ch] pb-5 text-sm leading-6 text-pretty text-neutral-600">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
