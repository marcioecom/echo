import { Link } from "@tanstack/react-router"

import { BrandLogo } from "@/components/brand-logo"

const footerAnchors = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const

export function LandingFooter() {
  return (
    <footer className="border-t bg-[oklch(0.99_0.008_220)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <BrandLogo variant="compact" imageClassName="h-6 w-auto" />
          <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
            WhatsApp customer support that answers from your knowledge and
            brings in a person when it needs to.
          </p>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          >
            {footerAnchors.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-neutral-700 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              className="text-neutral-700 outline-none hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              Sign in
            </Link>
          </nav>
          <p className="max-w-md text-xs leading-5 text-neutral-500 md:text-right">
            Echo is in a private pilot. If you do not recognize Echo, do not
            enter your details.
          </p>
        </div>
      </div>
    </footer>
  )
}
