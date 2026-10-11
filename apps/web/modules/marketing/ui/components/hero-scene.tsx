"use client"

import {
  BookOpen01Icon,
  InboxIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { useHeroParallax } from "@/modules/marketing/hooks/use-hero-parallax"
import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { GlassChip } from "./glass-chip"
import { PhoneMockup } from "./phone-mockups"

const chipIcons = [BookOpen01Icon, UserMultiple02Icon, InboxIcon] as const

const chipClassNames = [
  "hero-float hero-parallax-near lg:absolute lg:top-16 lg:left-0 xl:left-4",
  "hero-float hero-float-delay-1 hero-parallax-mid lg:absolute lg:top-6 lg:right-0 xl:right-2",
  "hero-float hero-float-delay-2 hero-parallax-near lg:absolute lg:top-40 lg:right-0 xl:right-8",
] as const

export function HeroScene() {
  const sceneRef = useHeroParallax<HTMLDivElement>()
  const { copy } = useLanding()
  const conversations = [
    {
      key: "hours",
      tilt: "left" as const,
      className:
        "hero-float hero-float-delay-3 hero-parallax-far absolute bottom-2 left-[4%] z-0 hidden sm:block",
      messages: [
        { from: "customer" as const, text: copy.hero.hoursIn },
        { from: "echo" as const, text: copy.hero.hoursOut },
      ],
    },
    {
      key: "shipping",
      tilt: "none" as const,
      className: "hero-float hero-parallax-mid relative z-10",
      messages: [
        { from: "customer" as const, text: copy.hero.shippingIn },
        { from: "echo" as const, text: copy.hero.shippingOut },
      ],
    },
    {
      key: "handoff",
      tilt: "right" as const,
      className:
        "hero-float hero-float-delay-1 hero-parallax-far absolute right-[4%] bottom-2 z-0 hidden sm:block",
      messages: [
        { from: "customer" as const, text: copy.hero.handoffIn },
        { from: "echo" as const, text: copy.hero.handoffOut },
      ],
    },
  ]

  return (
    <div
      ref={sceneRef}
      className="relative mx-auto mt-8 w-full max-w-5xl px-4 pb-8 sm:mt-12 sm:pb-12"
    >
      <div className="flex flex-col items-center gap-3 lg:contents">
        {copy.hero.chips.map((label, index) => {
          const icon = chipIcons[index] ?? BookOpen01Icon
          const className = chipClassNames[index] ?? chipClassNames[0]

          return (
            <GlassChip
              key={label}
              icon={icon}
              label={label}
              className={className}
            />
          )
        })}
      </div>

      <p className="sr-only">{copy.hero.phonesSr}</p>
      <div
        aria-hidden
        className="relative mx-auto mt-6 flex h-[21rem] max-w-[38rem] items-end justify-center sm:mt-8 sm:h-[26rem] lg:mt-0"
      >
        {conversations.map((conversation) => (
          <PhoneMockup
            key={conversation.key}
            tilt={conversation.tilt}
            business={copy.hero.business}
            messages={conversation.messages}
            className={conversation.className}
          />
        ))}
      </div>
    </div>
  )
}
