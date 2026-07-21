import { BrandLogo } from "@/components/brand-logo"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <BrandLogo priority className="self-center rounded-2xl" />
        {children}
      </div>
    </div>
  )
}
