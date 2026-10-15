import { resolve } from "node:path"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { createDatabase } from "@workspace/db"
import {
  auditEvents,
  channelConnectionProviderBindings,
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
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const { databaseRef, supportAgentGraph } = vi.hoisted(() => ({
  databaseRef: { current: {} as object },
  supportAgentGraph: { invoke: vi.fn() },
}))

vi.mock("../../config/env", () => ({
  env: {
    AI_CHAT_MODEL: "openai/gpt-5.6-luna",
  },
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
    const channelAddress = `+5521${channelConnectionId.slice(-8).replace(/[A-Z]/g, "2")}`
    await database.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Support",
      address: channelAddress,
      status: "active",
    })
    await database.db.insert(channelConnectionProviderBindings).values({
      organizationId,
      channelConnectionId,
      provider: "twilio",
      externalAccountId: "AC11111111111111111111111111111111",
      externalSenderId: "XE11111111111111111111111111111111",
      routingAddress: channelAddress,
      credentialsCiphertext: "not-a-credential",
      credentialsNonce: "not-a-credential",
      credentialsAuthTag: "not-a-credential",
      credentialsKeyVersion: "v1",
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
      channelConnectionId,
      supportConversationId,
      messageId,
    }
  }

  async function insertInbound(
    state: {
      organizationId: string
      channelConnectionId: string
      supportConversationId: string
    },
    body: string,
    occurredAt: Date,
    contentType: "text" | "unsupported" = "text"
  ) {
    const messageId = createId()
    await database.db.insert(messages).values({
      id: messageId,
      organizationId: state.organizationId,
      supportConversationId: state.supportConversationId,
      channelConnectionId: state.channelConnectionId,
      direction: "inbound",
      senderType: "contact",
      contentType,
      body: contentType === "text" ? body : null,
      status: "received",
      occurredAt,
    })
    return messageId
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

    expect(supportAgentGraph.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: payload.organizationId,
        query: "Help",
      }),
      {
        runName: "support-agent",
        tags: ["support-agent", "inbound-message", "twilio"],
        metadata: {
          organizationId: payload.organizationId,
          conversationId: payload.supportConversationId,
          messageId: payload.messageId,
          channelProvider: "twilio",
          model: "openai/gpt-5.6-luna",
        },
      }
    )

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

  it("answers one burst from the latest inbound message", async () => {
    supportAgentGraph.invoke.mockResolvedValue({
      decision: { action: "reply", replyType: "answer", body: "Claro" },
    })
    const payload = await createState("worker-burst", "text")
    const base = new Date("2026-08-01T12:00:00.000Z")
    await database.db
      .update(messages)
      .set({ occurredAt: base, body: "quero um bolo" })
      .where(eq(messages.id, payload.messageId))
    await insertInbound(
      payload,
      "de chocolate",
      new Date("2026-08-01T12:00:01.000Z")
    )
    const thirdId = await insertInbound(
      payload,
      "para amanhã",
      new Date("2026-08-01T12:00:02.000Z")
    )

    await processInboundMessage({ ...payload, messageId: thirdId })

    expect(supportAgentGraph.invoke).toHaveBeenCalledTimes(1)
    expect(supportAgentGraph.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "quero um bolo\nde chocolate\npara amanhã",
        history: [
          "contact: quero um bolo",
          "contact: de chocolate",
          "contact: para amanhã",
        ],
      }),
      expect.objectContaining({
        metadata: expect.objectContaining({ messageId: thirdId }),
      })
    )
    const replies = await database.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.supportConversationId, payload.supportConversationId),
          eq(messages.senderType, "ai")
        )
      )
    expect(replies).toHaveLength(1)
    expect(replies[0]).toMatchObject({
      body: "Claro",
      replyToMessageId: thirdId,
      status: "pending",
    })
  })

  it("replies once when concurrent jobs race the same burst", async () => {
    supportAgentGraph.invoke.mockResolvedValue({
      decision: { action: "reply", replyType: "answer", body: "Claro" },
    })
    const payload = await createState("worker-burst-race", "text")
    const base = new Date("2026-08-01T12:00:00.000Z")
    await database.db
      .update(messages)
      .set({ occurredAt: base })
      .where(eq(messages.id, payload.messageId))
    const secondId = await insertInbound(
      payload,
      "e o prazo?",
      new Date("2026-08-01T12:00:01.000Z")
    )
    const thirdId = await insertInbound(
      payload,
      "do pedido",
      new Date("2026-08-01T12:00:02.000Z")
    )

    await Promise.all([
      processInboundMessage(payload),
      processInboundMessage({ ...payload, messageId: secondId }),
      processInboundMessage({ ...payload, messageId: thirdId }),
    ])

    expect(supportAgentGraph.invoke).toHaveBeenCalledTimes(1)
    expect(supportAgentGraph.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Help\ne o prazo?\ndo pedido",
      }),
      expect.any(Object)
    )
    const replies = await database.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.supportConversationId, payload.supportConversationId),
          eq(messages.senderType, "ai")
        )
      )
    expect(replies).toHaveLength(1)
    expect(replies[0]?.replyToMessageId).toBe(thirdId)
  })

  it("hands the burst to a human when an earlier message is unsupported", async () => {
    const payload = await createState("worker-burst-audio", "unsupported")
    const base = new Date("2026-08-01T12:00:00.000Z")
    await database.db
      .update(messages)
      .set({ occurredAt: base })
      .where(eq(messages.id, payload.messageId))
    const textId = await insertInbound(
      payload,
      "consegue ver o áudio?",
      new Date("2026-08-01T12:00:01.000Z")
    )

    await processInboundMessage({ ...payload, messageId: textId })

    expect(supportAgentGraph.invoke).not.toHaveBeenCalled()
    const [conversation] = await database.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, payload.supportConversationId))
    const [event] = await database.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, payload.organizationId),
          eq(auditEvents.eventType, "support_conversation.human_required")
        )
      )
    expect(conversation?.status).toBe("human_required")
    expect(event?.data).toEqual({
      messageId: payload.messageId,
      reason: "unsupported_content",
    })
  })
})
