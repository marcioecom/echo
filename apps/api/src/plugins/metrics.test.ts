import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerMetrics } from "./metrics"

describe("metrics plugin", () => {
  it("serves Prometheus metrics with one label per registered route", async () => {
    const app = Fastify()
    registerMetrics(app)
    app.get("/v1/things/:thingId", async () => ({ ok: true }))

    try {
      await app.ready()

      await app.inject({ method: "GET", url: "/v1/things/one" })
      await app.inject({ method: "GET", url: "/v1/things/two" })

      const response = await app.inject({ method: "GET", url: "/metrics" })

      expect(response.statusCode).toBe(200)
      expect(response.headers["content-type"]).toContain("text/plain")
      expect(response.headers["content-type"]).toContain("version=0.0.4")
      expect(response.body).toContain(
        'http_requests_total{method="GET",route="/v1/things/:thingId",status_code="200"} 2'
      )
      expect(response.body).not.toContain('route="/v1/things/one"')
      expect(response.body).not.toContain('route="/v1/things/two"')
      expect(response.body).not.toContain('route="/metrics"')
    } finally {
      await app.close()
    }
  })

  it("uses a constant label for unmatched routes", async () => {
    const app = Fastify()
    registerMetrics(app)

    try {
      await app.ready()
      await app.inject({ method: "GET", url: "/does-not-exist" })

      const response = await app.inject({ method: "GET", url: "/metrics" })

      expect(response.body).toContain('route="unmatched"')
      expect(response.body).not.toContain('route="/does-not-exist"')
    } finally {
      await app.close()
    }
  })
})
