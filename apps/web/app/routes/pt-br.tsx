import { createFileRoute } from "@tanstack/react-router"

import { landingHead } from "@/modules/marketing/i18n/head"
import { HomeView } from "@/modules/marketing/ui/views/home-view"

export const Route = createFileRoute("/pt-br")({
  head: () => landingHead("pt-BR"),
  component: PortugueseHomePage,
})

function PortugueseHomePage() {
  return <HomeView locale="pt-BR" />
}
