import { getSession } from "@/modules/auth/server/session"
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

export async function HomeView() {
  const session = await getSession()
  const signedIn = Boolean(session)

  return (
    <div className="min-h-svh bg-[oklch(0.99_0.01_220)] text-neutral-950">
      <a
        href="#problem"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-(--z-tooltip) focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-950 focus:shadow"
      >
        Skip to content
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
