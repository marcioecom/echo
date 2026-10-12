import { hostname } from "node:os"

import { createLoggerWithContext } from "@workspace/logger"
import {
  createJobClient,
  publishInboxEvent,
  waGatewayQueueName,
  waIngressJobNames,
} from "@workspace/jobs"
import { ChannelCredentialsCipher } from "@workspace/messaging"
import { Worker } from "bullmq"

import { createApp } from "./app"
import { env } from "./config/env"
import { database } from "./lib/db"
import { pingRedis, redisConnection } from "./lib/redis"
import { PostgresAuthKeyRepository } from "./modules/auth/postgres-auth-key-repository"
import { useEchoAuthState } from "./modules/auth/use-echo-auth-state"
import { handleWaGatewayJob, WaGateway } from "./modules/gateway"
import {
  openBaileysSocket,
  recallRecentMessage,
  rememberRecentMessage,
} from "./modules/session/open-socket"
import { humanSendDelayMs } from "./modules/session/pacing"
import {
  acquireSendSlot,
  claimInboundMessage,
} from "./modules/session/rate-limit"
import {
  PostgresSessionDirectory,
  type ConnectionRef,
} from "./modules/session/session-directory"
import { BaileysSession } from "./modules/session/session-runner"

const logger = createLoggerWithContext("wa-gateway")

async function main(): Promise<void> {
  const cipher = new ChannelCredentialsCipher({
    encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
    keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
  })
  const authKeys = new PostgresAuthKeyRepository(database.db)
  const directory = new PostgresSessionDirectory(database.db)
  const jobs = createJobClient(redisConnection)
  const ownerPod = env.POD_NAME ?? hostname()
  const pacing = {
    msPerChar: env.WA_COMPOSE_MS_PER_CHAR,
    minMs: env.WA_COMPOSE_MIN_MS,
    maxMs: env.WA_COMPOSE_MAX_MS,
  }

  const gateway = new WaGateway({
    findResumable: () => directory.findResumable(),
    createSession: (connection) =>
      openSession(connection, {
        cipher,
        authKeys,
        directory,
        jobs,
        ownerPod,
        pacing,
      }),
  })

  const worker = new Worker(
    waGatewayQueueName,
    (job) => handleWaGatewayJob(gateway, job),
    { connection: redisConnection, concurrency: 1 }
  )
  worker.on("failed", (job, error) => {
    logger.error("wa-gateway job failed", {
      jobName: job?.name,
      jobId: job?.id,
      channelConnectionId: job?.data?.channelConnectionId,
      error: error.message,
    })
  })

  const app = createApp()
  let shutdownPromise: Promise<void> | undefined

  async function shutdown(signal?: NodeJS.Signals): Promise<void> {
    shutdownPromise ??= performShutdown(signal)
    return shutdownPromise
  }

  async function performShutdown(signal?: NodeJS.Signals): Promise<void> {
    if (signal) logger.info("shutting down", { signal })
    const steps: Array<[string, () => Promise<unknown>]> = [
      ["gateway.stop", () => gateway.stop()],
      ["worker.close", () => worker.close()],
      ["app.close", () => app.close()],
      ["jobs.close", () => jobs.close()],
      ["redis.quit", () => redisConnection.quit()],
      ["database.close", () => database.close()],
    ]
    for (const [step, close] of steps) {
      try {
        await close()
      } catch (error) {
        logger.error("shutdown step failed", { error, step })
        process.exitCode = 1
      }
    }
  }

  process.once("SIGINT", () => void shutdown("SIGINT"))
  process.once("SIGTERM", () => void shutdown("SIGTERM"))

  await database.check()
  await pingRedis()
  await gateway.start()
  await app.listen({ host: env.WA_GATEWAY_HOST, port: env.WA_GATEWAY_PORT })
  logger.info("wa-gateway listening", { port: env.WA_GATEWAY_PORT })
}

async function openSession(
  connection: ConnectionRef,
  deps: {
    cipher: ChannelCredentialsCipher
    authKeys: PostgresAuthKeyRepository
    directory: PostgresSessionDirectory
    jobs: ReturnType<typeof createJobClient>
    ownerPod: string
    pacing: { msPerChar: number; minMs: number; maxMs: number }
  }
): Promise<BaileysSession> {
  const auth = await useEchoAuthState({
    ...connection,
    cipher: deps.cipher,
    repository: deps.authKeys,
    flushDelayMs: env.WA_AUTH_FLUSH_MS,
    batchSize: env.WA_AUTH_BATCH_SIZE,
  })
  const sessionLogger = {
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info(message, { ...data, ...connection }),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn(message, { ...data, ...connection }),
    error: (message: string, data?: Record<string, unknown>) =>
      logger.error(message, { ...data, ...connection }),
  }

  return new BaileysSession({
    ...connection,
    auth,
    ownerPod: deps.ownerPod,
    pairingTimeoutMs: env.WA_PAIRING_TIMEOUT_MS,
    directory: deps.directory,
    logger: sessionLogger,
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    composeDelayMs: (body) => humanSendDelayMs(body, deps.pacing),
    openSocket: () =>
      openBaileysSocket({
        auth,
        getMessage: (externalMessageId) =>
          recallRecentMessage(redisConnection, {
            channelConnectionId: connection.channelConnectionId,
            externalMessageId,
          }),
      }),
    publishQr: (qr) =>
      publishInboxEvent(redisConnection, connection.organizationId, {
        type: "channel.qr",
        channelConnectionId: connection.channelConnectionId,
        qr,
      }),
    publishPairingCode: (pairingCode) =>
      publishInboxEvent(redisConnection, connection.organizationId, {
        type: "channel.pairing_code",
        channelConnectionId: connection.channelConnectionId,
        pairingCode,
      }),
    publishStatus: () =>
      publishInboxEvent(redisConnection, connection.organizationId, {
        type: "channel.status_changed",
        channelConnectionId: connection.channelConnectionId,
      }),
    claimInbound: (externalMessageId) =>
      claimInboundMessage(redisConnection, {
        channelConnectionId: connection.channelConnectionId,
        externalMessageId,
      }),
    acquireSendSlot: (to) =>
      acquireSendSlot(redisConnection, {
        channelConnectionId: connection.channelConnectionId,
        to,
        connectionIntervalMs: env.WA_SEND_INTERVAL_MS,
        contactIntervalMs: env.WA_CONTACT_INTERVAL_MS,
      }),
    rememberMessage: (externalMessageId, message) =>
      rememberRecentMessage(redisConnection, {
        channelConnectionId: connection.channelConnectionId,
        externalMessageId,
        message,
      }),
    enqueueInbound: async (message) => {
      await deps.jobs.enqueue(waIngressJobNames.inbound, {
        ...connection,
        senderAddress: message.senderAddress,
        ...(message.senderDisplayName
          ? { senderDisplayName: message.senderDisplayName }
          : {}),
        externalMessageId: message.externalMessageId,
        content: message.content,
        receivedAt: new Date().toISOString(),
      })
    },
    enqueueStatus: (update) =>
      deps.jobs.enqueue(waIngressJobNames.status, update).then(() => undefined),
  })
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
