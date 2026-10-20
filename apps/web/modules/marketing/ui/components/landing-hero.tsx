"use client"

import { Link } from "@tanstack/react-router"

import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { HeroScene } from "./hero-scene"

type LandingHeroProps = {
  signedIn: boolean
}

export function LandingHero({ signedIn }: LandingHeroProps) {
  const { copy } = useLanding()
  const ctaHref = signedIn ? "/inbox" : "/sign-up"
  const ctaLabel = signedIn ? copy.hero.openInbox : copy.hero.joinPilot

  return (
    <section className="relative isolate min-h-svh overflow-hidden">
      <div className="landing-sky" aria-hidden />
      <div className="relative z-10 flex min-h-svh flex-col">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-28 text-center sm:pt-36 lg:flex-1">
          <h1 className="max-w-4xl text-[2.35rem] leading-[1.15] font-bold tracking-tight text-balance text-neutral-950 sm:text-[3.4rem] md:text-[4rem]">
            {copy.hero.before}
            <em className="font-instrument-serif font-normal italic">
              {copy.hero.em}
            </em>
            {copy.hero.after}
          </h1>
          <p className="mt-6 max-w-[42ch] text-base leading-7 text-pretty text-neutral-700 sm:text-lg">
            {copy.hero.subtext}
          </p>
          <div className="mt-8 flex flex-col items-center gap-2.5">
            <Link
              to={ctaHref}
              className="landing-cta inline-flex h-12 items-center rounded-full px-7 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)]"
            >
              {ctaLabel}
            </Link>
            {signedIn ? null : (
              <p className="text-sm text-neutral-600">
                {copy.hero.clickTrigger}
              </p>
            )}
          </div>
        </div>
        <HeroScene />
      </div>
    </section>
  )
}
