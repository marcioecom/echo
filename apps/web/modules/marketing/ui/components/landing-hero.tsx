import Link from "next/link"

import { HeroScene } from "./hero-scene"

type LandingHeroProps = {
  signedIn: boolean
}

export function LandingHero({ signedIn }: LandingHeroProps) {
  const ctaHref = signedIn ? "/inbox" : "/sign-up"
  const ctaLabel = signedIn ? "Open inbox" : "Join the pilot"

  return (
    <section className="relative isolate min-h-svh overflow-hidden">
      <div className="landing-sky" aria-hidden />
      <div className="relative z-10 flex min-h-svh flex-col">
        <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center px-5 pt-32 text-center sm:pt-36">
          <h1 className="max-w-4xl text-[2.5rem] leading-[1.08] font-bold tracking-[-0.04em] text-balance text-neutral-950 sm:text-6xl md:text-[4.25rem]">
            Answer your customers on{" "}
            <em className="font-instrument-serif font-normal italic">
              WhatsApp
            </em>
            , even while you sleep
          </h1>
          <p className="mt-6 max-w-[42ch] text-base leading-7 text-pretty text-neutral-700 sm:text-lg">
            Echo answers customer questions from your business knowledge and
            hands off to a human when it needs to.
          </p>
          <Link
            href={ctaHref}
            className="mt-8 inline-flex h-12 items-center rounded-full bg-neutral-950 px-7 text-sm font-medium text-white shadow-[0_10px_24px_oklch(0.2_0.02_260_/_0.28)] outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/35"
          >
            {ctaLabel}
          </Link>
        </div>
        <HeroScene />
      </div>
    </section>
  )
}
