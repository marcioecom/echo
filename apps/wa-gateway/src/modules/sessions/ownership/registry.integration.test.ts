import type { EchoAuthState } from "../auth-state"
import type { SessionEvents, SessionSocket } from "../types"

import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys"
import {
  baileysAuthKeys,
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
  organizations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import {
  waConnectionQueueName,
  waGatewayJobNames,
  waIngressJobNames,
} from "@workspace/jobs"
import { Queue, QueueEvents } from "bullmq"
import { eq } from "drizzle-orm"
import { afterAll, expect, it, vi } from "vitest"

import { database } from "@/lib/db"
import { jobs } from "@/lib/jobs"
import { redisConnection } from "@/lib/redis"

import { credentialsCipher } from "../adapters/credentials-cipher"
import { PostgresAuthKeysRepository } from "../repositories/postgres-auth-keys-repository"
import { PostgresSessionDirectory } from "../repositories/session-directory"
import { openSession } from "../use-cases/open-session"
import { SessionRegistry } from "./registry"

const simulated = vi.hoisted(() => {
  process.env.WA_COMPOSE_MIN_MS = "0"
  process.env.WA_COMPOSE_MAX_MS = "0"
  process.env.WA_COMPOSE_MS_PER_CHAR = "0"
  return {
    sockets: [] as Array<{
      socket: SessionSocket
      auth: EchoAuthState
      emit: (events: SessionEvents) => Promise<void>
      ended: boolean
      sends: string[]
    }>,
  }
})
vi.mock("../adapters/baileys-socket", () => ({
  openBaileysSocket: async ({ auth }: { auth: EchoAuthState }) => {
    let handler: (events: SessionEvents) => void | Promise<void> = () =>
      undefined
    const record = {
      auth,
      ended: false,
      sends: [] as string[],
      emit: async (events: SessionEvents) => {
        await handler(events)
      },
      socket: {} as SessionSocket,
    }
    record.socket = {
      ev: {
        process(next) {
          handler = next
          queueMicrotask(
            () =>
              void record.emit({
                "connection.update": auth.state.creds.registered
                  ? { connection: "open" }
                  : { qr: "fake-qr" },
              })
          )
        },
      },
      user: { id: auth.state.creds.me!.id },
      sendMessage: async (_jid, content) => {
        if (record.ended) throw new Error("closed socket used")
        record.sends.push(content.text)
        return { key: { id: `simulated-${record.sends.length}` } }
      },
      sendPresenceUpdate: async () => undefined,
      requestPairingCode: async () => "FAKE1234",
      downloadMedia: async () => {
        throw new Error("media download not simulated")
      },
      logout: async () => {
        record.ended = true
      },
      end: async () => {
        record.ended = true
      },
    }
    simulated.sockets.push(record)
    return record.socket
  },
}))
vi.mock("@/lib/jobs", () => ({
  jobs: { enqueue: vi.fn(async () => ({ id: "fake-ingress" })) },
}))

const organizationId = createId()
const a = { organizationId, channelConnectionId: createId() }
const b = { organizationId, channelConnectionId: createId() }
const registries: SessionRegistry[] = []
const queues: Queue[] = []
const events: QueueEvents[] = []
const addressA = `+5511${Date.now().toString().slice(-9)}`
const addressB = `+5521${Date.now().toString().slice(-9)}`

class TestDirectory extends PostgresSessionDirectory {
  override async findResumable() {
    return (await super.findResumable()).filter(
      (ref) => ref.organizationId === organizationId
    )
  }
}
const directory = new TestDirectory()
const authKeys = new PostgresAuthKeysRepository()

function openFor(ownerPod: string) {
  return (connection: typeof a, lease: Parameters<typeof openSession>[1]) =>
    openSession(connection, lease, { authKeys, directory, ownerPod })
}

async function seed(ref: typeof a, address: string) {
  await database.db
    .insert(channelConnections)
    .values({
      id: ref.channelConnectionId,
      organizationId,
      channelType: "whatsapp",
      name: "Gateway integration",
      status: "pending",
    })
  await database.db.insert(channelConnectionProviderBindings).values({
    ...ref,
    provider: "baileys",
    routingAddress: `pending:${ref.channelConnectionId}`,
    externalAccountId: `pending:${ref.channelConnectionId}`,
    externalSenderId: `pending:${ref.channelConnectionId}`,
    credentialsCiphertext: "unused",
    credentialsNonce: "unused",
    credentialsAuthTag: "unused",
    credentialsKeyVersion: "v1",
  })
  await database.db
    .insert(channelSessionStates)
    .values({ ...ref, state: "connecting" })
  const creds = initAuthCreds()
  creds.me = { id: `${address.slice(1)}@s.whatsapp.net`, name: "Integration" }
  await database.db.insert(baileysAuthKeys).values({
    id: createId(),
    ...ref,
    keyType: "creds",
    keyId: "creds",
    ...credentialsCipher.encrypt(JSON.stringify(creds, BufferJSON.replacer), {
      ...ref,
      provider: "baileys",
      keyType: "creds",
      keyId: "creds",
    }),
  })
}

async function ownerToken(ref: typeof a) {
  const [row] = await database.db
    .select()
    .from(channelSessionStates)
    .where(
      eq(channelSessionStates.channelConnectionId, ref.channelConnectionId)
    )
  return row!.ownerToken!
}

it("routes two connections only to their owners and recovers one without disturbing the other", async () => {
  await database.db
    .insert(organizations)
    .values({
      id: organizationId,
      name: "Gateway integration",
      slug: `gateway-${organizationId}`,
      createdAt: new Date(),
    })
  await seed(a, addressA)
  await seed(b, addressB)
  const first = new SessionRegistry({
    redis: redisConnection,
    directory,
    ownerPod: "integration-one",
    openSession: openFor("integration-one"),
  })
  const second = new SessionRegistry({
    redis: redisConnection,
    directory,
    ownerPod: "integration-two",
    openSession: openFor("integration-two"),
  })
  registries.push(first, second)
  await Promise.all([
    first.connect(a),
    first.connect(a),
    second.connect(a),
    first.connect(b),
    second.connect(b),
  ])
  await vi.waitFor(() => expect(simulated.sockets).toHaveLength(2))
  expect(
    simulated.sockets.filter((record) =>
      record.socket.user!.id.startsWith(addressA.slice(1))
    )
  ).toHaveLength(1)
  expect(
    simulated.sockets.filter((record) =>
      record.socket.user!.id.startsWith(addressB.slice(1))
    )
  ).toHaveLength(1)
  const socketA = simulated.sockets.find((record) =>
    record.socket.user!.id.startsWith(addressA.slice(1))
  )!
  const socketB = simulated.sockets.find((record) =>
    record.socket.user!.id.startsWith(addressB.slice(1))
  )!
  const queueA = new Queue(waConnectionQueueName(a.channelConnectionId), {
    connection: redisConnection,
  })
  const queueB = new Queue(waConnectionQueueName(b.channelConnectionId), {
    connection: redisConnection,
  })
  queues.push(queueA, queueB)
  const resultEvents = new QueueEvents(queueA.name, {
    connection: redisConnection,
  })
  events.push(resultEvents)
  await resultEvents.waitUntilReady()
  const pair = await queueA.add(waGatewayJobNames.pairingCode, {
    ...a,
    phoneNumber: addressA,
  })
  await pair.waitUntilFinished(resultEvents, 10_000)
  for (const record of [socketA, socketB]) {
    record.auth.state.creds.registered = true
    await record.emit({ "creds.update": {} })
    await record.emit({ "connection.update": { connection: "open" } })
  }
  const send = await queueA.add(waGatewayJobNames.send, {
    ...a,
    outboundMessageId: createId(),
    to: "+5511888888888",
    body: "message A",
  })
  expect(await send.waitUntilFinished(resultEvents, 10_000)).toEqual({
    ok: true,
    externalMessageId: "simulated-1",
  })
  expect(socketA.sends).toEqual(["message A"])
  expect(socketB.sends).toEqual([])
  const crossTenant = await queueA.add(waGatewayJobNames.send, {
    ...a,
    organizationId: createId(),
    outboundMessageId: createId(),
    to: "+5511888888888",
    body: "must not send",
  })
  expect(
    await crossTenant.waitUntilFinished(resultEvents, 10_000)
  ).toMatchObject({ ok: false })
  expect(socketA.sends).toEqual(["message A"])

  const inboundId = `integration-${createId()}`
  await socketA.emit({
    "messages.upsert": {
      type: "notify",
      messages: [
        {
          key: {
            id: inboundId,
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          message: { conversation: "inbound A" },
        },
      ],
    },
  })
  expect(jobs.enqueue).toHaveBeenCalledWith(
    waIngressJobNames.inbound,
    expect.objectContaining({
      ...a,
      externalMessageId: inboundId,
      content: { type: "text", body: "inbound A" },
    })
  )

  const oldToken = await ownerToken(a)
  const tokenB = await ownerToken(b)
  await redisConnection.pexpire(`wa:lease:${a.channelConnectionId}`, 1)
  await vi.waitFor(async () =>
    expect(
      await redisConnection.exists(`wa:lease:${a.channelConnectionId}`)
    ).toBe(0)
  )
  await Promise.all([
    first.send({ ...a, to: "+5511888888888", body: "stale" }),
    second.send({ ...a, to: "+5511888888888", body: "stale" }),
  ])
  await vi.waitFor(() => expect(socketA.ended).toBe(true))
  await Promise.all([first.start(), second.start()])
  await vi.waitFor(() => expect(simulated.sockets).toHaveLength(3), {
    timeout: 10_000,
  })
  const recovered = simulated.sockets[2]!
  expect(recovered.auth.state.creds.registered).toBe(true)
  expect(await ownerToken(a)).not.toBe(oldToken)
  expect(await ownerToken(b)).toBe(tokenB)
  expect(socketB.ended).toBe(false)
  expect(
    await directory.setState({
      ...a,
      ownerToken: oldToken,
      state: "logged_out",
      lastError: null,
    })
  ).toBe(false)
  const authRepository = new PostgresAuthKeysRepository()
  const authScope = { ...a, ownerToken: oldToken }
  const persistedAuth = await authRepository.list(authScope)
  await authRepository.deleteAll(authScope)
  expect(await authRepository.list(authScope)).toEqual(persistedAuth)
  await database.db
    .update(channelConnections)
    .set({ status: "disabled" })
    .where(eq(channelConnections.id, a.channelConnectionId))
  await database.db
    .update(channelSessionStates)
    .set({ ownerToken: null })
    .where(eq(channelSessionStates.channelConnectionId, a.channelConnectionId))
  await vi.waitFor(() => expect(recovered.ended).toBe(true), { timeout: 7_000 })
  expect(socketB.ended).toBe(false)
  const eventsB = new QueueEvents(queueB.name, { connection: redisConnection })
  events.push(eventsB)
  await eventsB.waitUntilReady()
  const sendB = await queueB.add(waGatewayJobNames.send, {
    ...b,
    outboundMessageId: createId(),
    to: "+5511888888888",
    body: "message B",
  })
  expect(await sendB.waitUntilFinished(eventsB, 10_000)).toEqual({
    ok: true,
    externalMessageId: "simulated-1",
  })
  expect(socketB.sends).toEqual(["message B"])
}, 40_000)

afterAll(async () => {
  await Promise.allSettled(registries.map((registry) => registry.stop()))
  await Promise.allSettled(events.map((event) => event.close()))
  for (const queue of queues) {
    await queue.obliterate({ force: true })
    await queue.close()
  }
  for (const ref of [a, b])
    await redisConnection.del(`wa:lease:${ref.channelConnectionId}`)
  await database.db
    .delete(baileysAuthKeys)
    .where(eq(baileysAuthKeys.organizationId, organizationId))
  await database.db
    .delete(channelSessionStates)
    .where(eq(channelSessionStates.organizationId, organizationId))
  await database.db
    .delete(channelConnectionProviderBindings)
    .where(eq(channelConnectionProviderBindings.organizationId, organizationId))
  await database.db
    .delete(channelConnections)
    .where(eq(channelConnections.organizationId, organizationId))
  await database.db
    .delete(organizations)
    .where(eq(organizations.id, organizationId))
  await redisConnection.quit()
  await database.close()
})
