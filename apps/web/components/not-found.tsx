import { Link } from "@tanstack/react-router"

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        That address is not part of Echo.
      </p>
      <Link
        to="/"
        className="mt-6 text-sm font-medium underline underline-offset-4"
      >
        Back to home
      </Link>
    </main>
  )
}
