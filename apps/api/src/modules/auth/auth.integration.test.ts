import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Redis } from "ioredis"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createApp } from "../../app"
import type { ApiEnv } from "../../config/env"
import { createEmailQueue } from "../notifications/email-queue"
import { createAuth } from "./auth"

const env: ApiEnv = {
  DATABASE_URL: "postgres://unused",
  REDIS_URL: "redis://unused",
  DEPENDENCY_TIMEOUT_MS: 10_000,
  API_HOST: "127.0.0.1",
  API_PORT: 3001,
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  BETTER_AUTH_SECRET: "integration-test-secret-integration-test",
  BETTER_AUTH_URL: "http://localhost:3001",
  WEB_APP_URL: "http://localhost:3000",
}

function extractCookies(
  headers: Record<string, string | string[] | number | undefined>,
): string {
  const raw = headers["set-cookie"]
  const setCookies = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? [raw]
      : undefined
  if (!setCookies) return ""
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ")
}

describe("auth and organization access", () => {
  const postgresContainer = new PostgreSqlContainer("postgres:17-alpine")
  const redisContainer = new GenericContainer("redis:7.4-alpine").withExposedPorts(
    6379,
  )

  let app: ReturnType<typeof createApp>
  let database: ReturnType<typeof createDatabase>
  let queueConnection: Redis
  let stopPostgres: () => Promise<void>
  let stopRedis: () => Promise<void>

  beforeAll(async () => {
    const [postgres, redisService] = await Promise.all([
      postgresContainer.start(),
      redisContainer.start(),
    ])
    stopPostgres = () => postgres.stop().then(() => undefined)
    stopRedis = () => redisService.stop().then(() => undefined)

    database = createDatabase(postgres.getConnectionUri(), 10_000)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })

    queueConnection = new Redis(
      `redis://${redisService.getHost()}:${redisService.getMappedPort(6379)}`,
      { maxRetriesPerRequest: null },
    )
    const emailQueue = createEmailQueue(queueConnection)

    const auth = createAuth({
      db: database.db,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      webAppUrl: env.WEB_APP_URL,
      deliverInvitationEmail: (request) =>
        emailQueue.enqueueSendInvitationEmail(request),
    })

    app = createApp(env, {
      postgres: () => database.check(),
      redis: async () => undefined,
      auth,
    })
  }, 120_000)

  afterAll(async () => {
    await Promise.allSettled([
      app?.close(),
      database?.close(),
      queueConnection?.quit(),
      stopPostgres?.(),
      stopRedis?.(),
    ])
  })

  async function signUp(email: string, name: string): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, name, password: "password123" },
    })
    expect(response.statusCode).toBe(200)
    return extractCookies(response.headers)
  }

  it("runs the full owner and operator entry path", async () => {
    const ownerCookies = await signUp("owner@acme.test", "Owner")

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
    })
    expect(unauthenticated.statusCode).toBe(200)
    expect(unauthenticated.json()).toBeNull()

    const ownerSessionBeforeOrg = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie: ownerCookies },
    })
    expect(ownerSessionBeforeOrg.statusCode).toBe(200)
    const sessionBeforeOrg = ownerSessionBeforeOrg.json() as {
      user: { id: string; email: string }
      session: { activeOrganizationId: string | null }
    }
    expect(sessionBeforeOrg.user.email).toBe("owner@acme.test")
    expect(sessionBeforeOrg.session.activeOrganizationId).toBeNull()

    const createOrg = await app.inject({
      method: "POST",
      url: "/api/auth/organization/create",
      headers: { cookie: ownerCookies },
      payload: { name: "Acme", slug: "acme" },
    })
    expect(createOrg.statusCode).toBe(200)
    const organization = createOrg.json() as { id: string }

    const ownerFullOrg = await app.inject({
      method: "GET",
      url: "/api/auth/organization/get-full-organization",
      headers: { cookie: ownerCookies },
    })
    expect(ownerFullOrg.statusCode).toBe(200)
    const ownerOrg = ownerFullOrg.json() as {
      id: string
      name: string
      slug: string
      members: Array<{ userId: string; role: string }>
    }
    expect(ownerOrg).toMatchObject({
      id: organization.id,
      name: "Acme",
      slug: "acme",
    })
    expect(
      ownerOrg.members.find(
        (member) => member.userId === sessionBeforeOrg.user.id,
      )?.role,
    ).toBe("owner")

    const invite = await app.inject({
      method: "POST",
      url: "/api/auth/organization/invite-member",
      headers: { cookie: ownerCookies },
      payload: { email: "operator@acme.test", role: "operator" },
    })
    expect(invite.statusCode).toBe(200)
    const invitation = invite.json() as { id: string }

    const operatorCookies = await signUp("operator@acme.test", "Operator")

    const operatorOrgBeforeAccept = await app.inject({
      method: "GET",
      url: "/api/auth/organization/get-full-organization",
      headers: { cookie: operatorCookies },
    })
    expect(operatorOrgBeforeAccept.statusCode).toBe(200)
    expect(operatorOrgBeforeAccept.json()).toBeNull()

    const accept = await app.inject({
      method: "POST",
      url: "/api/auth/organization/accept-invitation",
      headers: { cookie: operatorCookies },
      payload: { invitationId: invitation.id },
    })
    expect(accept.statusCode).toBe(200)

    const setActive = await app.inject({
      method: "POST",
      url: "/api/auth/organization/set-active",
      headers: { cookie: operatorCookies },
      payload: { organizationId: organization.id },
    })
    expect(setActive.statusCode).toBe(200)

    const operatorSession = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie: operatorCookies },
    })
    expect(operatorSession.statusCode).toBe(200)
    const operator = operatorSession.json() as {
      user: { id: string; email: string }
    }

    const operatorFullOrg = await app.inject({
      method: "GET",
      url: "/api/auth/organization/get-full-organization",
      headers: { cookie: operatorCookies },
    })
    expect(operatorFullOrg.statusCode).toBe(200)
    const operatorOrg = operatorFullOrg.json() as {
      id: string
      members: Array<{ userId: string; role: string }>
    }
    expect(operatorOrg.id).toBe(organization.id)
    expect(
      operatorOrg.members.find(
        (member) => member.userId === operator.user.id,
      )?.role,
    ).toBe("operator")

    const operatorInviteAttempt = await app.inject({
      method: "POST",
      url: "/api/auth/organization/invite-member",
      headers: { cookie: operatorCookies },
      payload: { email: "another@acme.test", role: "operator" },
    })
    expect(operatorInviteAttempt.statusCode).toBe(403)
  })
})
