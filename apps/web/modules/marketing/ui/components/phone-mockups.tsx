import { cn } from "@workspace/ui/lib/utils"

type ChatLine = {
  from: "customer" | "echo"
  text: string
}

type PhoneMockupProps = {
  business: string
  messages: ChatLine[]
  className?: string
  tilt?: "left" | "none" | "right"
}

export function PhoneMockup({
  business,
  messages,
  className,
  tilt = "none",
}: PhoneMockupProps) {
  return (
    <figure
      className={cn(
        "w-[12.5rem] shrink-0 origin-bottom drop-shadow-[0_24px_40px_oklch(0.35_0.05_230_/_0.22)] sm:w-[14.5rem]",
        className
      )}
    >
      <div
        className={cn(
          "rounded-[2rem] border border-white/50 bg-neutral-950 p-1.5 shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.08)]",
          tilt === "left" && "phone-tilt-left",
          tilt === "right" && "phone-tilt-right"
        )}
      >
        <div className="relative overflow-hidden rounded-[1.55rem] bg-[#efeae2]">
          <span
            aria-hidden
            className="absolute top-2 left-1/2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-neutral-950"
          />
          <div className="flex items-center gap-2 bg-[#008069] px-3 pt-7 pb-2.5 text-white">
            <span
              aria-hidden
              className="flex size-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-medium"
            >
              {business.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium">{business}</p>
              <p className="text-[10px] text-white">WhatsApp</p>
            </div>
          </div>
          <div className="whatsapp-wallpaper flex min-h-56 flex-col justify-end gap-1.5 p-2.5 pb-3">
            {messages.map((message) => (
              <p
                key={message.text}
                className={cn(
                  "max-w-[88%] rounded-lg px-2.5 py-1.5 text-[11px] leading-4 text-neutral-800 shadow-sm",
                  message.from === "customer"
                    ? "ml-auto rounded-tr-sm bg-[#d9fdd3]"
                    : "rounded-tl-sm bg-white"
                )}
              >
                {message.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

export const heroConversations = {
  hours: {
    business: "Harbor Goods",
    messages: [
      {
        from: "customer" as const,
        text: "What time do you close on Saturday?",
      },
      {
        from: "echo" as const,
        text: "Saturday we are open 10am–6pm. Pickup is available until 5:30pm.",
      },
    ],
  },
  shipping: {
    business: "Harbor Goods",
    messages: [
      {
        from: "customer" as const,
        text: "Do you ship to Porto Alegre?",
      },
      {
        from: "echo" as const,
        text: "Yes. Orders to Porto Alegre usually arrive in 3–5 business days.",
      },
    ],
  },
  handoff: {
    business: "Harbor Goods",
    messages: [
      {
        from: "customer" as const,
        text: "I need to change my delivery address.",
      },
      {
        from: "echo" as const,
        text: "Passing you to Ana from the team.",
      },
    ],
  },
}
