"use client"

import type { Locale } from "@/modules/marketing/i18n/dictionary"

import { Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"

import { localeHomePath } from "@/modules/marketing/i18n/dictionary"
import { useLanding } from "@/modules/marketing/i18n/landing-context"
import { persistLanguageChoice } from "@/modules/marketing/i18n/negotiation"

const options: { locale: Locale; labelKey: "english" | "portuguese" }[] = [
  { locale: "en", labelKey: "english" },
  { locale: "pt-BR", labelKey: "portuguese" },
]

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, copy } = useLanding()

  return (
    <div
      role="group"
      aria-label={copy.nav.language}
      className={cn(
        "inline-flex items-center rounded-full border border-white/70 bg-white/45 p-0.5 text-xs font-medium",
        className
      )}
    >
      {options.map((option) => {
        const active = option.locale === locale

        return (
          <Link
            key={option.locale}
            to={localeHomePath(option.locale)}
            aria-current={active ? "page" : undefined}
            hrefLang={option.locale === "pt-BR" ? "pt-BR" : "en"}
            onClick={() =>
              persistLanguageChoice(option.locale === "pt-BR" ? "pt-br" : "en")
            }
            className={cn(
              "inline-flex h-7 min-w-8 items-center justify-center rounded-full px-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
              active
                ? "bg-[var(--echo-primary)] text-[var(--echo-primary-foreground)]"
                : "text-neutral-700 hover:text-[var(--echo-green-700)]"
            )}
          >
            {copy.nav[option.labelKey]}
          </Link>
        )
      })}
    </div>
  )
}
