import { SectionHeading } from "./section-heading"

const problems = [
  {
    quote: "Can you send the price again?",
    title: "The same answers, typed all day",
    body: "Hours, prices, and policies already live in your head. On WhatsApp they get retyped into every new thread.",
  },
  {
    quote: "I wrote last night.",
    title: "After hours, the thread goes quiet",
    body: "A customer who messages at 9pm waits until morning. Many do not wait. They write to the next business that replies.",
  },
]

export function ProblemSection() {
  return (
    <section
      id="problem"
      className="landing-section scroll-mt-24 border-t border-white/60 bg-[oklch(0.99_0.012_220)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <SectionHeading
          eyebrow="The problem"
          title={
            <>
              The same questions,{" "}
              <em className="font-instrument-serif font-normal italic">
                all day
              </em>
              . Then silence after hours.
            </>
          }
          description="WhatsApp is where customers already write. The work is keeping up without turning every evening into a second shift."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {problems.map((problem) => (
            <article
              key={problem.title}
              className="rounded-3xl border border-white/80 bg-white/70 p-6 shadow-[0_12px_40px_oklch(0.4_0.04_230_/_0.06)] backdrop-blur-xl sm:p-8"
            >
              <p className="font-instrument-serif text-xl text-neutral-800 italic">
                “{problem.quote}”
              </p>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {problem.title}
              </h3>
              <p className="mt-2 max-w-[42ch] text-sm leading-6 text-pretty text-neutral-600">
                {problem.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
