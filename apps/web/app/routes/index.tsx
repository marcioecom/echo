import { createFileRoute } from "@tanstack/react-router"

import { HomeView } from "@/modules/marketing/ui/views/home-view"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return <HomeView />
}
