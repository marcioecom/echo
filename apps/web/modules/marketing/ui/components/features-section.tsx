"use client"

import {
  BookOpen01Icon,
  InboxIcon,
  HelpCircleIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { SectionHeading } from "./section-heading"

const featureIcons = [
  BookOpen01Icon,
  HelpCircleIcon,
  UserMultiple02Icon,
  InboxIcon,
] as const

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
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {copy.features.items.map((feature, index) => (
            <article
              key={feature.title}
              className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_10px_30px_oklch(0.4_0.05_130_/_0.04)] sm:p-8"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-[var(--echo-green-100)] text-[var(--echo-green-700)]">
                <HugeiconsIcon
                  icon={featureIcons[index] ?? BookOpen01Icon}
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
