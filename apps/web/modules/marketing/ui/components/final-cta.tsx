import Link from "next/link"

type FinalCtaProps = {
  signedIn: boolean
}

export function FinalCta({ signedIn }: FinalCtaProps) {
  const href = signedIn ? "/inbox" : "/sign-up"
  const label = signedIn ? "Open inbox" : "Join the pilot"

  return (
    <section className="landing-section bg-neutral-950 px-5 py-20 text-center sm:px-8 md:py-28">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
          Answer the next WhatsApp{" "}
          <em className="font-instrument-serif font-normal italic">without</em>{" "}
          staying awake for it
        </h2>
        <p className="mx-auto mt-5 max-w-[42ch] text-base leading-7 text-pretty text-neutral-300">
          Join the 30-day pilot. Echo answers from your knowledge and hands off
          to a human when it needs to.
        </p>
        <Link
          href={href}
          className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-medium text-neutral-950 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {label}
        </Link>
      </div>
    </section>
  )
}
