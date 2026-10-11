import { SectionHeading } from "./section-heading"

const niches = [
  {
    name: "Clinics",
    body: "Opening hours, what to bring, and whether a referral is needed.",
  },
  {
    name: "Salons",
    body: "Prices, services, and which requests need a person to book.",
  },
  {
    name: "Pet shops",
    body: "Stock, pickup hours, and care questions you already have in writing.",
  },
  {
    name: "Real estate agencies",
    body: "Listing facts you publish. Visits and offers go to an agent.",
  },
  {
    name: "Driving schools",
    body: "Class times, documents, and fees — then a person for enrollment.",
  },
]

export function NichesSection() {
  return (
    <section
      id="businesses"
      className="landing-section scroll-mt-24 bg-[oklch(0.99_0.01_220)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          title={
            <>
              Built for{" "}
              <em className="font-instrument-serif font-normal italic">
                local businesses
              </em>
            </>
          }
          description="If the same WhatsApp questions come in every day, Echo can take the written ones. The rest stays with your team."
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {niches.map((niche) => (
            <li
              key={niche.name}
              className="rounded-3xl border border-neutral-200/80 bg-white px-6 py-7"
            >
              <h3 className="font-instrument-serif text-2xl italic">
                {niche.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-pretty text-neutral-600">
                {niche.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
