import { Link } from "@tanstack/react-router"

export function DefaultError({ error }: { error: Error }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        {error.message || "The page could not be loaded."}
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
