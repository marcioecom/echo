import { SectionHeading } from "./section-heading"

const faqs = [
  {
    question: "Is this a dedicated WhatsApp number?",
    answer:
      "Yes. Echo uses a dedicated number through the official WhatsApp API. It is not a shared inbox on someone’s personal phone.",
  },
  {
    question: "Does the AI get things wrong?",
    answer:
      "Yes. Language models make mistakes. That is why Echo hands off to a human instead of guessing — and why it asks a clarifying question when the request is unclear.",
  },
  {
    question: "What happens with audio, photos, or stickers?",
    answer:
      "They go to a human. Echo answers written text from your knowledge base. Media is a handoff, not something it tries to interpret.",
  },
  {
    question: "Can Echo book appointments or send campaigns?",
    answer:
      "No. There is no scheduling, no broadcasts, and no bulk messaging. Those conversations belong with a person on your team.",
  },
  {
    question: "Do I need to connect other tools?",
    answer:
      "No. Echo today is WhatsApp, your knowledge base, and a web inbox. Integrations are not part of the pilot.",
  },
]

export function FaqSection() {
  return (
    <section
      id="faq"
      className="landing-section scroll-mt-24 bg-[oklch(0.99_0.008_220)]"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-28">
        <SectionHeading
          title={
            <>
              Honest answers,{" "}
              <em className="font-instrument-serif font-normal italic">
                including the limits
              </em>
            </>
          }
          description="Echo is early. If a capability is not listed here, assume it is not built."
        />
        <div className="border-t border-neutral-200">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group border-b border-neutral-200 py-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-neutral-950 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span
                  aria-hidden
                  className="text-xl leading-none text-neutral-600 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-pretty text-neutral-600">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
