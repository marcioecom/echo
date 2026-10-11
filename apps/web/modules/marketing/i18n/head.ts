import { getAppUrl } from "@/lib/env"

import { dictionary, localeHomePath, type Locale } from "./dictionary"

function absoluteUrl(path: string) {
  return new URL(path, `${getAppUrl().replace(/\/$/, "")}/`).toString()
}

export function landingHead(locale: Locale) {
  const copy = dictionary[locale]
  const canonical = absoluteUrl(localeHomePath(locale))
  const enUrl = absoluteUrl("/")
  const ptUrl = absoluteUrl("/pt-br")

  return {
    meta: [
      { title: copy.meta.title },
      { name: "description", content: copy.meta.description },
      { property: "og:title", content: copy.meta.title },
      { property: "og:description", content: copy.meta.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      {
        property: "og:locale",
        content: locale === "pt-BR" ? "pt_BR" : "en_US",
      },
      {
        property: "og:locale:alternate",
        content: locale === "pt-BR" ? "en_US" : "pt_BR",
      },
      { property: "og:site_name", content: "Echo" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: copy.meta.title },
      { name: "twitter:description", content: copy.meta.description },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "alternate", href: enUrl, hreflang: "en" },
      { rel: "alternate", href: ptUrl, hreflang: "pt-BR" },
      { rel: "alternate", href: enUrl, hreflang: "x-default" },
    ],
  }
}
