import { cn } from "@workspace/ui/lib/utils"

export function AuthHeader({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <header className={cn("mb-8", className)}>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="mt-2.5 max-w-[46ch] text-base leading-7 text-pretty text-muted-foreground">
        {description}
      </p>
    </header>
  )
}
