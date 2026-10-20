"use client"

import type { Locale } from "@/modules/marketing/i18n/dictionary"

import { authClient } from "@/lib/auth-client"
import {
  LandingProvider,
  useLanding,
} from "@/modules/marketing/i18n/landing-context"
import { DemoSection } from "@/modules/marketing/ui/components/demo-section"
import { FaqSection } from "@/modules/marketing/ui/components/faq-section"
import { FeaturesSection } from "@/modules/marketing/ui/components/features-section"
import { FinalCta } from "@/modules/marketing/ui/components/final-cta"
import { HowItWorksSection } from "@/modules/marketing/ui/components/how-it-works-section"
import { LandingFooter } from "@/modules/marketing/ui/components/landing-footer"
import { LandingHero } from "@/modules/marketing/ui/components/landing-hero"
import { LandingNav } from "@/modules/marketing/ui/components/landing-nav"
import { NichesSection } from "@/modules/marketing/ui/components/niches-section"
import { PricingSection } from "@/modules/marketing/ui/components/pricing-section"
import { ProblemSection } from "@/modules/marketing/ui/components/problem-section"

import "../hero.css"

type HomeViewProps = {
  locale: Locale
}

export function HomeView({ locale }: HomeViewProps) {
  return (
    <LandingProvider locale={locale}>
      <LandingPage />
    </LandingProvider>
  )
}

function LandingPage() {
  const { data } = authClient.useSession()
  const { copy } = useLanding()
  const signedIn = Boolean(data?.session)

  return (
    <div className="landing min-h-svh">
      <a
        href="#problem"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-(--z-tooltip) focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-950 focus:shadow"
      >
        {copy.skip}
      </a>
      <LandingNav signedIn={signedIn} />

      <main>
        <LandingHero signedIn={signedIn} />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <DemoSection />
        <NichesSection />
        <PricingSection signedIn={signedIn} />
        <FaqSection />
        <FinalCta signedIn={signedIn} />
      </main>

      <LandingFooter />
    </div>
  )
}
