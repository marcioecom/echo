import { createFileRoute } from "@tanstack/react-router"

import { landingHead } from "@/modules/marketing/i18n/head"
import { HomeView } from "@/modules/marketing/ui/views/home-view"

export const Route = createFileRoute("/")({
  head: () => landingHead("en"),
  component: HomePage,
})

function HomePage() {
  return <HomeView locale="en" />
}
