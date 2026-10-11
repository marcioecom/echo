import { Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"

const brandLogoAssets = {
  horizontal: {
    src: "/brand/echo-logo-horizontal.png",
    width: 678,
    height: 224,
    defaultClassName: "h-10 w-auto md:h-11",
  },
  compact: {
    src: "/brand/echo-logo-compact.png",
    width: 458,
    height: 182,
    defaultClassName: "h-8 w-auto",
  },
  mark: {
    src: "/brand/echo-logo-mark.png",
    width: 246,
    height: 246,
    defaultClassName: "h-10 w-auto",
  },
} as const

type BrandLogoVariant = keyof typeof brandLogoAssets

type BrandLogoProps = {
  href?: "/" | "/pt-br"
  variant?: BrandLogoVariant
  priority?: boolean
  className?: string
  imageClassName?: string
}

export function BrandLogo({
  href = "/",
  variant = "horizontal",
  priority = false,
  className,
  imageClassName,
}: BrandLogoProps) {
  const asset = brandLogoAssets[variant]

  return (
    <Link
      to={href}
      aria-label="Echo"
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <img
        src={asset.src}
        alt=""
        width={asset.width}
        height={asset.height}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn(asset.defaultClassName, imageClassName)}
      />
    </Link>
  )
}
