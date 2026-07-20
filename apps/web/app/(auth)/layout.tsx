import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* REVIEW: maybe remove this Echo link or add some logo */}
        <Link href="/" className="self-center text-lg font-medium">
          Echo
        </Link>
        {children}
      </div>
    </div>
  )
}
