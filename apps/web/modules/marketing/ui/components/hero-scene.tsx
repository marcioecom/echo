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
      className="relative mx-auto mt-10 w-full max-w-5xl px-4 pb-6 sm:mt-14 sm:pb-10"
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
        Three WhatsApp conversations. Echo answers from the shop knowledge
        base, then hands a delivery-address change to Ana from the team.
      </p>
      <div
        aria-hidden
        className="relative mx-auto mt-8 flex h-[22rem] max-w-[44rem] items-end justify-center sm:h-[26rem] lg:mt-2"
      >
        <PhoneMockup
          tilt="left"
          business={heroConversations.hours.business}
          messages={heroConversations.hours.messages}
          className="hero-float hero-float-delay-3 hero-parallax-far absolute bottom-6 left-[8%] hidden sm:block lg:left-[12%]"
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
          className="hero-float hero-float-delay-1 hero-parallax-far absolute right-[8%] bottom-6 hidden sm:block lg:right-[12%]"
        />
      </div>
    </div>
  )
}
