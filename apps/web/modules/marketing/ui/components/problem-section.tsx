"use client"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

export function ProblemSection() {
  const { copy } = useLanding()

  return (
    <section
      id="problem"
      className="landing-section landing-surface scroll-mt-24 border-t border-white/60"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          eyebrow={copy.problem.eyebrow}
          title={
            <>
              {copy.problem.titleBefore}
              <em className="font-instrument-serif font-normal italic">
                {copy.problem.titleEm}
              </em>
              {copy.problem.titleAfter}
            </>
          }
          description={copy.problem.description}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {copy.problem.cards.map((problem) => (
            <article
              key={problem.title}
              className="rounded-3xl border border-white/80 bg-white/70 p-6 shadow-[0_12px_40px_oklch(0.4_0.06_130_/_0.06)] backdrop-blur-xl sm:p-8"
            >
              <p className="font-instrument-serif text-xl text-neutral-800 italic">
                “{problem.quote}”
              </p>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {problem.title}
              </h3>
              <p className="mt-2 max-w-[42ch] text-sm leading-6 text-pretty text-neutral-600">
                {problem.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
