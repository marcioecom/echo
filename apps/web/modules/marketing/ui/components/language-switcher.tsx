"use client"

import type { Locale } from "@/modules/marketing/i18n/dictionary"

import { Globe02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useNavigate } from "@tanstack/react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { localeHomePath } from "@/modules/marketing/i18n/dictionary"
import { useLanding } from "@/modules/marketing/i18n/landing-context"
import { persistLanguageChoice } from "@/modules/marketing/i18n/negotiation"

const options = [
  {
    locale: "pt-BR",
    codeKey: "portuguese",
    label: "Português",
    lang: "pt-BR",
  },
  { locale: "en", codeKey: "english", label: "English", lang: "en" },
] as const satisfies ReadonlyArray<{
  locale: Locale
  codeKey: "english" | "portuguese"
  label: string
  lang: string
}>

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, copy } = useLanding()
  const navigate = useNavigate()
  const current =
    options.find((option) => option.locale === locale) ?? options[1]

  function selectLanguage(next: string) {
    if (next !== "en" && next !== "pt-BR") return
    if (next === locale) return
    persistLanguageChoice(next === "pt-BR" ? "pt-br" : "en")
    void navigate({ to: localeHomePath(next) })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${copy.nav.language}: ${current.label}`}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/80 bg-white/60 px-3 text-sm font-medium text-neutral-800 transition-colors outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-neutral-900/20 aria-expanded:bg-white",
            className
          )}
        >
          <HugeiconsIcon
            icon={Globe02Icon}
            size={16}
            strokeWidth={1.8}
            aria-hidden
            className="text-neutral-500"
          />
          <span aria-hidden>{copy.nav[current.codeKey]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="min-w-48 rounded-xl border border-white/80 bg-white p-1.5 shadow-[0_8px_24px_oklch(0.4_0.06_130_/_0.12)]"
      >
        <DropdownMenuRadioGroup
          aria-label={copy.nav.language}
          value={locale}
          onValueChange={selectLanguage}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.locale}
              value={option.locale}
              lang={option.lang}
              className="min-h-9 cursor-pointer px-3 text-sm focus:bg-[var(--echo-green-50)] focus:text-[var(--echo-green-900)]"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
