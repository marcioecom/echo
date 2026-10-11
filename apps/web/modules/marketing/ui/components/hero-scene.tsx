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

export function HeroScene() {
  const sceneRef = useHeroParallax<HTMLDivElement>()
  const { copy } = useLanding()
  const chips = copy.hero.chips.map((label, index) => ({
    label,
    icon: chipIcons[index] ?? BookOpen01Icon,
  }))
  const leftChip = chips[0]
  const rightChips = chips.slice(1)
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
      className="relative mx-auto mt-8 w-full max-w-7xl px-4 pb-8 sm:mt-12 sm:pb-12"
    >
      <div className="mb-5 flex flex-col items-center gap-3 lg:hidden">
        {chips.map((chip, index) => (
          <GlassChip
            key={chip.label}
            icon={chip.icon}
            label={chip.label}
            className={
              index === 0
                ? "hero-float z-20"
                : `hero-float hero-float-delay-${index} z-20`
            }
          />
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(12.5rem,16rem)_minmax(0,1fr)_minmax(12.5rem,16rem)] lg:items-center lg:gap-3 xl:grid-cols-[minmax(15rem,18rem)_minmax(22rem,38rem)_minmax(15rem,18rem)] xl:justify-center xl:gap-8">
        <div className="relative z-20 hidden lg:flex lg:flex-col lg:items-end lg:gap-24 lg:justify-self-end">
          {leftChip ? (
            <GlassChip
              icon={leftChip.icon}
              label={leftChip.label}
              className="hero-float z-20 w-full max-w-[15rem] xl:max-w-64"
            />
          ) : null}
        </div>

        <p className="sr-only">{copy.hero.phonesSr}</p>
        <div
          aria-hidden
          className="relative z-10 mx-auto flex h-[21rem] w-full max-w-[30rem] items-end justify-center sm:h-[26rem] xl:max-w-[38rem]"
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

        <div className="relative z-20 hidden lg:flex lg:flex-col lg:items-start lg:gap-14 lg:justify-self-start xl:gap-16">
          {rightChips.map((chip, index) => (
            <GlassChip
              key={chip.label}
              icon={chip.icon}
              label={chip.label}
              className={
                index === 0
                  ? "hero-float hero-float-delay-1 z-20 w-full max-w-[15rem] xl:max-w-64"
                  : "hero-float hero-float-delay-2 z-20 w-full max-w-[15rem] xl:max-w-64"
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}
