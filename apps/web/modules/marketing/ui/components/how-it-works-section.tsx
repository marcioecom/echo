import { SectionHeading } from "./section-heading"

const steps = [
  {
    title: "You send your business knowledge",
    body: "Hours, prices, policies — the written answers you already give. Echo uses that knowledge. It does not invent the rest.",
  },
  {
    title: "We connect your WhatsApp",
    body: "A dedicated number on the official WhatsApp API. Customers write there. Your personal phone stays yours.",
  },
  {
    title: "Echo answers, and hands off",
    body: "Straightforward written questions get a reply. When it is unsure, or the customer sends audio, a person on your team continues.",
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="landing-section scroll-mt-24 bg-[oklch(0.97_0.02_220)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          title={
            <>
              Three steps.{" "}
              <em className="font-instrument-serif font-normal italic">
                No extra tools.
              </em>
            </>
          }
          description="You do not need a new helpdesk stack. Knowledge in, WhatsApp connected, conversations in one inbox."
        />
        <ol className="mt-14 grid gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-3xl border border-white/70 bg-white/55 p-6 backdrop-blur-xl sm:p-8"
            >
              <span className="font-instrument-serif text-4xl text-neutral-600 italic">
                0{index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-balance">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-pretty text-neutral-600">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
