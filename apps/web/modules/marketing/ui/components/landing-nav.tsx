"use client"

import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useId, useState } from "react"

import { BrandLogo } from "@/components/brand-logo"

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const

type LandingNavProps = {
  signedIn: boolean
}

export function LandingNav({ signedIn }: LandingNavProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const startHref = signedIn ? "/inbox" : "/sign-up"
  const startLabel = signedIn ? "Open inbox" : "Get started"
  const signInHref = signedIn ? "/inbox" : "/login"
  const signInLabel = signedIn ? "Dashboard" : "Sign in"

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-(--z-sticky) flex justify-center px-3 pt-4 sm:px-5 sm:pt-5">
      <div className="pointer-events-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/70 bg-white/50 px-3 py-2 shadow-[0_8px_32px_oklch(0.4_0.04_230_/_0.1)] backdrop-blur-xl sm:px-4">
          <BrandLogo
            priority
            variant="compact"
            imageClassName="h-7 w-auto sm:h-8"
          />

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 lg:flex"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm text-neutral-700 transition-colors outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
              >
                {link.label}
              </a>
            ))}
            <Link
              to={signInHref}
              className="rounded-full px-3 py-1.5 text-sm text-neutral-700 transition-colors outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              {signInLabel}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={startHref}
              className="inline-flex h-9 items-center rounded-full bg-white px-3.5 text-sm font-medium text-neutral-950 shadow-sm outline-none hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-neutral-900/20 sm:px-4"
            >
              {startLabel}
            </Link>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full text-neutral-800 outline-none hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-neutral-900/20 lg:hidden"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close navigation" : "Open navigation"}
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
            aria-label="Mobile"
            className="mt-2 rounded-2xl border border-white/70 bg-white/70 p-2 shadow-[0_12px_32px_oklch(0.4_0.04_230_/_0.12)] backdrop-blur-xl lg:hidden"
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
