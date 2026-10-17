import { waIngressJobNames } from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"

import { env } from "@/config/env"
import { jobs } from "@/lib/jobs"
import { redisConnection } from "@/lib/redis"

import { openBaileysSocket } from "../adapters/baileys-socket"
import { credentialsCipher } from "../adapters/credentials-cipher"
import { useEchoAuthState } from "../auth-state"
import type { SessionLease } from "../ownership/lease"
import { humanSendDelayMs } from "../traffic/pacing"
import {
  publishChannelQr,
  publishChannelStatus,
  publishPairingCode,
} from "../events/publish-channel-event"
import { PostgresAuthKeysRepository } from "../repositories/postgres-auth-keys-repository"
import type { SessionDirectory } from "../repositories/session-directory"
import { acquireSendSlot, claimInboundMessage } from "../traffic/rate-limit"
import { recallRecentMessage, rememberRecentMessage } from "../recent-messages"
import { BaileysSession } from "../session"
import type { ConnectionRef } from "../types"

const logger = createLoggerWithContext("wa-gateway:session")

export async function openSession(
  connection: ConnectionRef,
  lease: SessionLease,
  deps: {
    authKeys: PostgresAuthKeysRepository
    directory: SessionDirectory
    ownerPod: string
  }
): Promise<BaileysSession> {
  const auth = await useEchoAuthState({
    ...connection,
    ownerToken: lease.token,
    cipher: credentialsCipher,
    repository: deps.authKeys,
    flushDelayMs: env.WA_AUTH_FLUSH_MS,
    batchSize: env.WA_AUTH_BATCH_SIZE,
  })
  const sessionLogger = logger.child({
    organizationId: connection.organizationId,
    channelConnectionId: connection.channelConnectionId,
  })
  const pacing = {
    msPerChar: env.WA_COMPOSE_MS_PER_CHAR,
    minMs: env.WA_COMPOSE_MIN_MS,
    maxMs: env.WA_COMPOSE_MAX_MS,
  }

  return new BaileysSession({
    ...connection,
    auth,
    ownerPod: deps.ownerPod,
    ownerToken: lease.token,
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

