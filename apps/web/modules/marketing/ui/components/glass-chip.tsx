import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"

type GlassChipProps = {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  label: string
  className?: string
}

export function GlassChip({ icon, label, className }: GlassChipProps) {
  return (
    <p
      className={cn(
        "inline-flex max-w-64 items-center gap-2.5 rounded-full border border-white/70 bg-white/55 px-3.5 py-2 text-left text-[13px] leading-5 text-neutral-800 shadow-[0_8px_24px_oklch(0.4_0.06_130_/_0.08)] backdrop-blur-xl",
        className
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-[var(--echo-green-700)]">
        <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} />
      </span>
      <span>{label}</span>
    </p>
  )
}
