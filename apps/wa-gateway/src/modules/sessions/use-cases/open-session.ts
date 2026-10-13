import { hostname } from "node:os"

import { waIngressJobNames } from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"

import { env } from "@/config/env"
import { jobs } from "@/lib/jobs"
import { redisConnection } from "@/lib/redis"

import { openBaileysSocket } from "../adapters/baileys-socket"
import { createRedisCommandBus } from "../adapters/session-commands"
import { RedisSessionLease } from "../adapters/session-lease"
import { credentialsCipher } from "../adapters/credentials-cipher"
import { useEchoAuthState } from "../auth-state"
import {
  publishChannelQr,
  publishChannelStatus,
  publishPairingCode,
} from "../events/publish-channel-event"
import { humanSendDelayMs } from "../pacing"
import { PostgresAuthKeysRepository } from "../repositories/postgres-auth-keys-repository"
import {
  PostgresSessionDirectory,
  type SessionDirectory,
} from "../repositories/session-directory"
import { acquireSendSlot, claimInboundMessage } from "../rate-limit"
import { recallRecentMessage, rememberRecentMessage } from "../recent-messages"
import { SessionManager } from "../session-manager"
import { BaileysSession } from "../session"
import type { ConnectionRef } from "../types"

const logger = createLoggerWithContext("wa-gateway:session")

export async function openSession(
  connection: ConnectionRef,
  deps: {
    authKeys: PostgresAuthKeysRepository
    directory: SessionDirectory
    ownerPod: string
    isOwner: () => boolean
  }
): Promise<BaileysSession> {
  const auth = await useEchoAuthState({
    ...connection,
    cipher: credentialsCipher,
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
  const pacing = {
    msPerChar: env.WA_COMPOSE_MS_PER_CHAR,
    minMs: env.WA_COMPOSE_MIN_MS,
    maxMs: env.WA_COMPOSE_MAX_MS,
  }

  return new BaileysSession({
    ...connection,
    auth,
    ownerPod: deps.ownerPod,
    isOwner: deps.isOwner,
    pairingTimeoutMs: env.WA_PAIRING_TIMEOUT_MS,
    directory: deps.directory,
    logger: sessionLogger,
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    composeDelayMs: (body) => humanSendDelayMs(body, pacing),
    openSocket: () =>
      openBaileysSocket({
        auth,
        getMessage: (externalMessageId) =>
          recallRecentMessage(redisConnection, {
            channelConnectionId: connection.channelConnectionId,
            externalMessageId,
          }),
      }),
    publishQr: (qr) => publishChannelQr({ ...connection, qr }),
    publishPairingCode: (pairingCode) =>
      publishPairingCode({ ...connection, pairingCode }),
    publishStatus: () => publishChannelStatus(connection),
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
      await jobs.enqueue(waIngressJobNames.inbound, {
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
    enqueueStatus: async (update) => {
      await jobs.enqueue(waIngressJobNames.status, update)
    },
  })
}

export function createSessionManager(): SessionManager {
  const directory = new PostgresSessionDirectory()
  const authKeys = new PostgresAuthKeysRepository()
  const ownerPod = env.POD_NAME ?? hostname()
  const managerLogger = {
    info: (message: string, data?: Record<string, unknown>) =>
      data ? logger.info(message, data) : logger.info(message),
    warn: (message: string, data?: Record<string, unknown>) =>
      data ? logger.warn(message, data) : logger.warn(message),
    error: (message: string, data?: Record<string, unknown>) =>
      data ? logger.error(message, data) : logger.error(message),
  }
  return new SessionManager({
    podId: ownerPod,
    maxSessions: env.MAX_SESSIONS_PER_POD,
    leaseTtlMs: env.LEASE_TTL_MS,
    renewIntervalMs: env.LEASE_RENEW_MS,
    leases: new RedisSessionLease(redisConnection),
    bus: createRedisCommandBus(redisConnection, managerLogger),
    listClaimable: () => directory.listClaimable(),
    setOwner: (connection, podId) =>
      directory.setOwner({ ...connection, ownerPod: podId }),
    createSession: (connection, isOwner) =>
      openSession(connection, { authKeys, directory, ownerPod, isOwner }),
    logger: managerLogger,
  })
}
