"use client"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { PhoneMockup } from "./phone-mockups"
import { SectionHeading } from "./section-heading"

export function DemoSection() {
  const { copy } = useLanding()

  return (
    <section
      id="demo"
      className="landing-section landing-band-strong scroll-mt-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-28">
        <div className="flex justify-center lg:justify-start">
          <PhoneMockup
            business={copy.demo.business}
            messages={copy.demo.messages}
          />
        </div>
        <div>
          <SectionHeading
            title={
              <>
                {copy.demo.titleBefore}
                <em className="font-instrument-serif font-normal italic">
                  {copy.demo.titleEm}
                </em>
                {copy.demo.titleAfter}
              </>
            }
            description={copy.demo.description}
          />
          <ol className="mt-10 space-y-5">
            {copy.demo.beats.map((beat, index) => (
              <li key={beat.label} className="flex gap-4">
                <span className="font-instrument-serif w-8 shrink-0 text-2xl text-neutral-600 italic">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-medium">{beat.label}</h3>
                  <p className="mt-1 max-w-[46ch] text-sm leading-6 text-pretty text-neutral-600">
                    {beat.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
