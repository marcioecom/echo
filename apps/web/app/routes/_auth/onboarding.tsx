import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_auth/onboarding")({
  // Setup moved out of the auth layout. An Organization is created inside the
  // first-run flow, not next to a sign-in pitch. Keep the path as a redirect so
  // older links and stored redirect params still resolve.
  beforeLoad: () => {
    throw redirect({ to: "/setup" })
  },
})
