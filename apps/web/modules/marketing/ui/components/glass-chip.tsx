import type { ComponentProps } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

type GlassChipProps = {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  label: string
  className?: string
}

export function GlassChip({ icon, label, className }: GlassChipProps) {
  return (
    <p
      className={cn(
        "inline-flex max-w-64 items-center gap-2.5 rounded-full border border-white/80 bg-white/80 px-3.5 py-2 text-left text-[13px] leading-5 text-neutral-800 backdrop-blur-md",
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
