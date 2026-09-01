import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import {
  auditEvents,
  channelConnections,
  channelIdentities,
  contacts,
  messages,
  organizations,
  supportConversations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import type { ProcessInboundMessageJob } from "@workspace/jobs"
import type { Job } from "bullmq"
import { and, count, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { databaseRef, supportAgentGraph } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  supportAgentGraph: { invoke: vi.fn() },
}))

vi.mock("../../lib/db", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, property) => Reflect.get(databaseRef.current, property),
    }
  ),
}))
vi.mock("./orchestration/support-agent-graph", () => ({ supportAgentGraph }))
vi.mock("../../queues/support-conversations", () => ({
  supportConversationsQueue: { add: vi.fn() },
}))

import { handleProcessInboundMessage } from "./process-inbound-message"

describe("process inbound Message", () => {
  const container = new PostgreSqlContainer("pgvector/pgvector:pg18")
  let database: ReturnType<typeof createDatabase>
  let stop: () => Promise<void>

  beforeAll(async () => {
    const postgres = await container.start()
    stop = () => postgres.stop().then(() => undefined)
    database = createDatabase(postgres.getConnectionUri(), 10_000)
    databaseRef.current = database
    await database.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    await migrate(database.db, {
      migrationsFolder: resolve(process.cwd(), "../../packages/db/migrations"),
    })
  }, 60_000)

  afterAll(async () => {
    await Promise.allSettled([database?.close(), stop?.()])
  })

  async function createState(
    slug: string,
    contentType: "text" | "unsupported"
  ) {
    const organizationId = createId()
    const contactId = createId()
    const channelIdentityId = createId()
    const channelConnectionId = createId()
    const supportConversationId = createId()
    const messageId = createId()
    await database.db.insert(organizations).values({
      id: organizationId,
      name: slug,
      slug,
      status: "active",
      createdAt: new Date(),
    })
    await database.db.insert(contacts).values({ id: contactId, organizationId })
    await database.db.insert(channelIdentities).values({
      id: channelIdentityId,
      organizationId,
      contactId,
      channelType: "whatsapp",
      address: `+5511${organizationId.slice(-8).replace(/[A-Z]/g, "1")}`,
    })
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: `+5521${channelConnectionId.slice(-8).replace(/[A-Z]/g, "2")}`,
      status: "active",
    })
    await database.db.insert(supportConversations).values({
      id: supportConversationId,
      organizationId,
      channelIdentityId,
      channelConnectionId,
      status: "open",
    })
    await database.db.insert(messages).values({
      id: messageId,
      organizationId,
      supportConversationId,
      channelConnectionId,
      direction: "inbound",
      senderType: "contact",
      contentType,
      body: contentType === "text" ? "Help" : null,
      status: "received",
      occurredAt: new Date(),
    })
    return {
      organizationId,
      channelIdentityId,
      supportConversationId,
      messageId,
    }
  }

  async function processInboundMessage(
    payload: ProcessInboundMessageJob
  ): Promise<void> {
    await handleProcessInboundMessage({ data: payload } as Job)
  }

  beforeEach(() => {
    supportAgentGraph.invoke.mockReset()
  })

  it("moves unsupported content to human_required exactly once", async () => {
    const payload = await createState("worker-unsupported", "unsupported")

    await processInboundMessage(payload)
    await processInboundMessage(payload)

    const [conversation] = await database.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, payload.supportConversationId))
    const [events] = await database.db
      .select({ value: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, payload.organizationId),
          eq(auditEvents.eventType, "support_conversation.human_required")
        )
      )
    expect(conversation?.status).toBe("human_required")
    expect(events?.value).toBe(1)
  })

  it("hands text content to a human when knowledge is insufficient", async () => {
    supportAgentGraph.invoke.mockResolvedValue({
      decision: { action: "handoff", reason: "low_confidence" },
    })
    const payload = await createState("worker-text", "text")

    await processInboundMessage(payload)

    const [conversation] = await database.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, payload.supportConversationId))
    expect(conversation?.status).toBe("human_required")
  })

  it("does not reopen a resolved Conversation for unsupported content", async () => {
    const payload = await createState("worker-resolved", "unsupported")
    await database.db
      .update(supportConversations)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(supportConversations.id, payload.supportConversationId))

    await processInboundMessage(payload)

    const [conversation] = await database.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, payload.supportConversationId))
    expect(conversation?.status).toBe("resolved")
  })

  it("rejects IDs that do not belong to one tenant-scoped state", async () => {
    const first = await createState("worker-first-tenant", "unsupported")
    const second = await createState("worker-second-tenant", "unsupported")

    await expect(
      processInboundMessage({
        ...first,
        organizationId: second.organizationId,
      })
    ).rejects.toThrow("do not identify one tenant state")
  })
})
