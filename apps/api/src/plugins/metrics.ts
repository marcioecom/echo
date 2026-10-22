import type { FastifyInstance } from "fastify"

import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client"

const unmatchedRoute = "unmatched"

const excludedPaths = new Set(["/metrics"])
const excludedPrefixes = ["/health/"]

export function registerMetrics(app: FastifyInstance): void {
  const register = new Registry()
  collectDefaultMetrics({ register })

  // Metric and label names are a contract with dashboards in the platform repo.
  const requests = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests.",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  })

  const duration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds.",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  })

  const skipped = new WeakSet<object>()

  app.addHook("onRequest", async (request) => {
    if (isExcluded(request.url)) {
      skipped.add(request)
    }
  })

  app.addHook("onResponse", async (request, reply) => {
    if (skipped.has(request)) return

    // routeOptions.url is the registered pattern; the raw URL and unmatched
    // routes would blow up metric cardinality.
    const route = request.routeOptions.url ?? unmatchedRoute
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    }

    requests.inc(labels)
    duration.observe(labels, reply.elapsedTime / 1000)
  })

  // /metrics is unauthenticated on purpose: only in-cluster Prometheus reaches it.
  app.get("/metrics", { logLevel: "silent" }, async (_request, reply) => {
    reply.type(register.contentType)
    return register.metrics()
  })
}

function isExcluded(url: string): boolean {
  const path = url.split("?", 1)[0] ?? url
  return (
    excludedPaths.has(path) ||
    excludedPrefixes.some((prefix) => path.startsWith(prefix))
  )
}
