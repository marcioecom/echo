import { PhoneMockup } from "./phone-mockups"
import { SectionHeading } from "./section-heading"

const demoMessages = [
  {
    from: "customer" as const,
    text: "How much is a haircut?",
  },
  {
    from: "echo" as const,
    text: "For which service — women's cut, men's cut, or a beard trim?",
  },
  {
    from: "customer" as const,
    text: "Women's cut. Can I book Saturday?",
  },
  {
    from: "echo" as const,
    text: "Passing you to Ana from the team. She can check Saturday with you.",
  },
]

const beats = [
  {
    label: "Clarify",
    body: "The price depends on the service, so Echo asks before answering.",
  },
  {
    label: "Answer from knowledge",
    body: "Once the service is clear, a written price can come from your knowledge base.",
  },
  {
    label: "Hand off",
    body: "Booking is not something Echo does. Saturday goes to a person.",
  },
]

export function DemoSection() {
  return (
    <section
      id="demo"
      className="landing-section scroll-mt-24 bg-[oklch(0.96_0.025_220)]"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-28">
        <div className="flex justify-center lg:justify-start">
          <PhoneMockup business="Harbor Goods" messages={demoMessages} />
        </div>
        <div>
          <SectionHeading
            title={
              <>
                A conversation, not a{" "}
                <em className="font-instrument-serif font-normal italic">
                  widget
                </em>
              </>
            }
            description="Customers stay on WhatsApp. Echo reads the thread, answers what it can, and brings in a teammate when the request leaves the knowledge base."
          />
          <ol className="mt-10 space-y-5">
            {beats.map((beat, index) => (
              <li key={beat.label} className="flex gap-4">
                <span className="font-instrument-serif w-8 shrink-0 text-2xl text-neutral-600 italic">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-medium">{beat.label}</h3>
                  <p className="mt-1 max-w-[46ch] text-sm leading-6 text-pretty text-neutral-600">
                    {beat.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
