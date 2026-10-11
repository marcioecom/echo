"use client"

import {
  BookOpen01Icon,
  InboxIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { useHeroParallax } from "@/modules/marketing/hooks/use-hero-parallax"

import { GlassChip } from "./glass-chip"
import { heroConversations, PhoneMockup } from "./phone-mockups"

const chips = [
  {
    icon: BookOpen01Icon,
    label: "Answers from your own knowledge base",
    className:
      "hero-float hero-parallax-near lg:absolute lg:top-16 lg:left-0 xl:left-4",
  },
  {
    icon: UserMultiple02Icon,
    label: "Hands off to a human when needed",
    className:
      "hero-float hero-float-delay-1 hero-parallax-mid lg:absolute lg:top-6 lg:right-0 xl:right-2",
  },
  {
    icon: InboxIcon,
    label: "One web inbox for your team",
    className:
      "hero-float hero-float-delay-2 hero-parallax-near lg:absolute lg:top-40 lg:right-0 xl:right-8",
  },
] as const

export function HeroScene() {
  const sceneRef = useHeroParallax<HTMLDivElement>()

  return (
    <div
      ref={sceneRef}
      className="relative mx-auto mt-8 w-full max-w-5xl px-4 pb-8 sm:mt-12 sm:pb-12"
    >
      <div className="flex flex-col items-center gap-3 lg:contents">
        {chips.map((chip) => (
          <GlassChip
            key={chip.label}
            icon={chip.icon}
            label={chip.label}
            className={chip.className}
          />
        ))}
      </div>

      <p className="sr-only">
        Three WhatsApp conversations. Echo answers from the shop knowledge base,
        then hands a delivery-address change to Ana from the team.
      </p>
      <div
        aria-hidden
        className="relative mx-auto mt-6 flex h-[21rem] max-w-[38rem] items-end justify-center sm:mt-8 sm:h-[26rem] lg:mt-0"
      >
        <PhoneMockup
          tilt="left"
          business={heroConversations.hours.business}
          messages={heroConversations.hours.messages}
          className="hero-float hero-float-delay-3 hero-parallax-far absolute bottom-2 left-[4%] z-0 hidden sm:block"
        />
        <PhoneMockup
          business={heroConversations.shipping.business}
          messages={heroConversations.shipping.messages}
          className="hero-float hero-parallax-mid relative z-10"
        />
        <PhoneMockup
          tilt="right"
          business={heroConversations.handoff.business}
          messages={heroConversations.handoff.messages}
          className="hero-float hero-float-delay-1 hero-parallax-far absolute right-[4%] bottom-2 z-0 hidden sm:block"
        />
      </div>
    </div>
  )
}
