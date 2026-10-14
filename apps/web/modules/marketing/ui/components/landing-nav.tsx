"use client"

import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useId, useState } from "react"

import { BrandLogo } from "@/components/brand-logo"
import { localeHomePath } from "@/modules/marketing/i18n/dictionary"
import { useLanding } from "@/modules/marketing/i18n/landing-context"

import { LanguageSwitcher } from "./language-switcher"

type LandingNavProps = {
  signedIn: boolean
}

export function LandingNav({ signedIn }: LandingNavProps) {
  const { locale, copy } = useLanding()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const startHref = signedIn ? "/inbox" : "/sign-up"
  const startLabel = signedIn ? copy.nav.openInbox : copy.nav.getStarted
  const signInHref = signedIn ? "/inbox" : "/login"
  const signInLabel = signedIn ? copy.nav.dashboard : copy.nav.signIn
  const navLinks = [
    { href: "#how-it-works", label: copy.nav.howItWorks },
    { href: "#features", label: copy.nav.features },
    { href: "#pricing", label: copy.nav.pricing },
    { href: "#faq", label: copy.nav.faq },
  ]

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-(--z-sticky) flex justify-center px-3 pt-4 sm:px-5 sm:pt-5">
      <div className="pointer-events-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/80 bg-white/80 px-3 py-2 shadow-[0_8px_24px_oklch(0.4_0.06_130_/_0.08)] backdrop-blur-md sm:px-4">
          <BrandLogo
            href={localeHomePath(locale)}
            priority
            variant="compact"
            imageClassName="h-7 w-auto sm:h-8"
          />

          <nav
            aria-label={copy.nav.primary}
            className="hidden items-center gap-1 lg:flex"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm text-neutral-700 transition-colors outline-none hover:text-[var(--echo-green-700)] focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)]"
              >
                {link.label}
              </a>
            ))}
            <Link
              to={signInHref}
              className="rounded-full px-3 py-1.5 text-sm text-neutral-700 transition-colors outline-none hover:text-[var(--echo-green-700)] focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)]"
            >
              {signInLabel}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              to={startHref}
              className="landing-cta inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)] sm:px-4"
            >
              {startLabel}
            </Link>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full text-neutral-800 outline-none hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-neutral-900/20 lg:hidden"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu}
              onClick={() => setOpen((current) => !current)}
            >
              <HugeiconsIcon
                icon={open ? Cancel01Icon : Menu01Icon}
                size={18}
                strokeWidth={1.8}
              />
            </button>
          </div>
        </div>

        {open ? (
          <nav
            id={menuId}
            aria-label={copy.nav.mobile}
            className="mt-2 rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_8px_24px_oklch(0.4_0.06_130_/_0.08)] backdrop-blur-md lg:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm text-neutral-800 outline-none hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
              >
                {link.label}
              </a>
            ))}
            <Link
              to={signInHref}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm text-neutral-800 outline-none hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              {signInLabel}
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  )
}
