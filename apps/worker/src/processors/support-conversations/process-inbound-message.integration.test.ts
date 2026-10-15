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

const { databaseRef, supportAgentGraph, draftUnsupportedHandoffCopy } =
  vi.hoisted(() => ({
    databaseRef: { current: {} as object },
    supportAgentGraph: { invoke: vi.fn() },
    draftUnsupportedHandoffCopy: vi.fn(),
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
vi.mock("./orchestration/support-agent-graph", () => ({
  supportAgentGraph,
  draftUnsupportedHandoffCopy,
}))
vi.mock("../../queues/support-conversations", () => ({
  supportConversationsQueue: { add: vi.fn() },
}))

import { supportConversationsQueue } from "../../queues/support-conversations"
import { handleProcessInboundMessage } from "./process-inbound-message"

const customerMessage =
  "Vou chamar alguém da equipe pra continuar com você, tá?"
const operatorSummary =
  "Quer trocar o endereço. A base não cobre troca. Tom calmo."

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
    draftUnsupportedHandoffCopy.mockReset()
    vi.mocked(supportConversationsQueue.add).mockReset()
  })

  async function outboundMessages(supportConversationId: string) {
    return database.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.supportConversationId, supportConversationId),
          eq(messages.direction, "outbound")
        )
      )
  }

  it("moves unsupported content to human_required exactly once", async () => {
    draftUnsupportedHandoffCopy.mockResolvedValue({
      customerMessage,
      summary: "Cliente enviou um anexo. A Echo não lê mídia. Tom neutro.",
    })
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
    const outbound = await outboundMessages(payload.supportConversationId)
    expect(conversation?.status).toBe("human_required")
    expect(conversation?.handoffReason).toBe("unsupported_content")
    expect(conversation?.handoffSummary).toContain("anexo")
    expect(events?.value).toBe(1)
    expect(outbound).toHaveLength(1)
    expect(outbound[0]).toMatchObject({
      senderType: "ai",
      status: "pending",
      body: customerMessage,
      replyToMessageId: payload.messageId,
    })
    expect(draftUnsupportedHandoffCopy).toHaveBeenCalledTimes(1)
    expect(draftUnsupportedHandoffCopy).toHaveBeenCalledWith(
      expect.objectContaining({ mediaKind: "unknown" })
    )
    expect(supportConversationsQueue.add).toHaveBeenCalledTimes(1)
  })

  it("hands text content to a human when knowledge is insufficient", async () => {
    supportAgentGraph.invoke.mockResolvedValue({
      decision: {
        action: "handoff",
        reason: "low_confidence",
        customerMessage,
        summary: operatorSummary,
      },
    })
    const payload = await createState("worker-text", "text")

    await processInboundMessage(payload)
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
    const [event] = await database.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, payload.organizationId),
          eq(auditEvents.eventType, "support_conversation.human_required")
        )
      )
    const outbound = await outboundMessages(payload.supportConversationId)
    expect(supportAgentGraph.invoke).toHaveBeenCalledTimes(1)
    expect(conversation?.status).toBe("human_required")
    expect(conversation?.handoffReason).toBe("low_confidence")
    expect(conversation?.handoffSummary).toBe(operatorSummary)
    expect(event?.actorType).toBe("ai")
    expect(event?.data).toEqual({
      messageId: payload.messageId,
      reason: "low_confidence",
    })
    expect(outbound).toHaveLength(1)
    expect(outbound[0]).toMatchObject({
      senderType: "ai",
      body: customerMessage,
      replyToMessageId: payload.messageId,
    })
    expect(supportConversationsQueue.add).toHaveBeenCalledTimes(1)
  })

  it("escalates to human_required when the AI flow fails on the last attempt", async () => {
    supportAgentGraph.invoke.mockRejectedValue(new Error("gateway down"))
    const payload = await createState("worker-ai-failure", "text")

    await expect(
      handleProcessInboundMessage({
        data: payload,
        attemptsMade: 3,
        opts: { attempts: 4 },
      } as Job)
    ).rejects.toThrow("gateway down")

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
    const outbound = await outboundMessages(payload.supportConversationId)
    expect(conversation?.status).toBe("human_required")
    expect(conversation?.handoffReason).toBe("ai_failure")
    expect(conversation?.handoffSummary).toBeNull()
    expect(event?.actorType).toBe("ai")
    expect(outbound).toHaveLength(1)
    expect(outbound[0]?.body).toContain(
      "Vou chamar alguém da equipe pra continuar com você."
    )
    expect(outbound[0]?.body).toContain(
      "I'll ask someone from the team to continue with you."
    )
    expect(outbound[0]?.senderType).toBe("ai")
  })

  it("keeps retrying when the AI flow fails before the last attempt", async () => {
    supportAgentGraph.invoke.mockRejectedValue(new Error("gateway down"))
    const payload = await createState("worker-ai-retry", "text")

    await expect(
      handleProcessInboundMessage({
        data: payload,
        attemptsMade: 0,
        opts: { attempts: 4 },
      } as Job)
    ).rejects.toThrow("gateway down")

    const [conversation] = await database.db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.id, payload.supportConversationId))
    const outbound = await outboundMessages(payload.supportConversationId)
    expect(conversation?.status).toBe("ai_active")
    expect(conversation?.handoffReason).toBeNull()
    expect(outbound).toHaveLength(0)
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
    expect(draftUnsupportedHandoffCopy).not.toHaveBeenCalled()
    expect(await outboundMessages(payload.supportConversationId)).toHaveLength(
      0
    )
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
