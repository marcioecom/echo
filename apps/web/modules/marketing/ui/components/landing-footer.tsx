"use client"

import { Link } from "@tanstack/react-router"

import { BrandLogo } from "@/components/brand-logo"
import { localeHomePath } from "@/modules/marketing/i18n/dictionary"
import { useLanding } from "@/modules/marketing/i18n/landing-context"

export function LandingFooter() {
  const { locale, copy } = useLanding()
  const footerAnchors = [
    { href: "#how-it-works", label: copy.nav.howItWorks },
    { href: "#features", label: copy.nav.features },
    { href: "#pricing", label: copy.nav.pricing },
    { href: "#faq", label: copy.nav.faq },
  ]

  return (
    <footer className="landing-surface border-t border-[var(--echo-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <BrandLogo
            href={localeHomePath(locale)}
            variant="compact"
            imageClassName="h-6 w-auto"
          />
          <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
            {copy.footer.blurb}
          </p>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          <nav
            aria-label={copy.footer.label}
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          >
            {footerAnchors.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-neutral-700 outline-none hover:text-[var(--echo-green-700)] focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)]"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              className="text-neutral-700 outline-none hover:text-[var(--echo-green-700)] focus-visible:ring-2 focus-visible:ring-[color:var(--echo-primary)]"
            >
              {copy.footer.signIn}
            </Link>
          </nav>
          <p className="max-w-md text-xs leading-5 text-neutral-500 md:text-right">
            {copy.footer.note}
          </p>
        </div>
      </div>
    </footer>
  )
}
