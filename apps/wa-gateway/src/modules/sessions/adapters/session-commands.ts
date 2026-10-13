import { randomUUID } from "node:crypto"

import type { Redis } from "ioredis"

import type { SessionLogger } from "../types"

export interface GatewayCommand {
  type: "connect" | "logout" | "pairing_code" | "send"
  organizationId: string
  channelConnectionId: string
  phoneNumber?: string
  to?: string
  body?: string
}

export interface CommandEnvelope {
  command: GatewayCommand
  replyTo: string
}

export interface CommandBus {
  subscribe(
    connectionId: string,
    handler: (envelope: CommandEnvelope) => void
  ): Promise<() => Promise<void>>
  request(
    connectionId: string,
    command: GatewayCommand,
    timeoutMs: number
  ): Promise<unknown>
  reply(replyTo: string, value: unknown): Promise<void>
  close(): Promise<void>
}

export function commandChannel(connectionId: string): string {
  return `wa:cmd:${connectionId}`
}

type ReplyHandler = (value: unknown) => void

export class InMemoryCommandBus implements CommandBus {
  private readonly handlers = new Map<
    string,
    (envelope: CommandEnvelope) => void
  >()
  private readonly replies = new Map<string, ReplyHandler>()
  private closed = false

  async subscribe(
    connectionId: string,
    handler: (envelope: CommandEnvelope) => void
  ): Promise<() => Promise<void>> {
    this.handlers.set(connectionId, handler)
    return async () => {
      if (this.handlers.get(connectionId) === handler) {
        this.handlers.delete(connectionId)
      }
    }
  }

  async request(
    connectionId: string,
    command: GatewayCommand,
    timeoutMs: number
  ): Promise<unknown> {
    const handler = this.handlers.get(connectionId)
    if (!handler || this.closed) return null
    const replyTo = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.replies.delete(replyTo)
        resolve(null)
      }, timeoutMs)
      this.replies.set(replyTo, (value) => {
        clearTimeout(timer)
        this.replies.delete(replyTo)
        resolve(value)
      })
      handler({ command, replyTo })
    })
  }

  async reply(replyTo: string, value: unknown): Promise<void> {
    this.replies.get(replyTo)?.(value)
  }

  async close(): Promise<void> {
    this.closed = true
    this.handlers.clear()
  }
}

export function createRedisCommandBus(
  redis: Redis,
  logger: SessionLogger
): CommandBus {
  const subscriber = redis.duplicate()
  const handlers = new Map<string, (envelope: CommandEnvelope) => void>()
  let closed = false

  subscriber.on("message", (channel: string, message: string) => {
    const handler = handlers.get(channel)
    if (!handler) return
    try {
      handler(JSON.parse(message) as CommandEnvelope)
    } catch (error) {
      logger.error("session command was not json", { error, channel })
    }
  })

  return {
    async subscribe(connectionId, handler) {
      const channel = commandChannel(connectionId)
      handlers.set(channel, handler)
      await subscriber.subscribe(channel)
      return async () => {
        if (handlers.get(channel) === handler) handlers.delete(channel)
        await subscriber.unsubscribe(channel)
      }
    },
    request(connectionId, command, timeoutMs) {
      if (closed) return Promise.resolve(null)
      const replyTo = `wa:cmd:reply:${randomUUID()}`
      return new Promise((resolve) => {
        let settled = false
        const finish = (value: unknown) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          subscriber.off("message", onMessage)
          subscriber.unsubscribe(replyTo).catch((error: unknown) => {
            logger.error("session reply unsubscribe failed", { error })
          })
          resolve(value)
        }
        const timer = setTimeout(() => finish(null), timeoutMs)
        const onMessage = (channel: string, message: string) => {
          if (channel !== replyTo) return
          try {
            finish(JSON.parse(message) as unknown)
          } catch (error) {
            logger.error("session reply was not json", { error })
            finish(null)
          }
        }
        subscriber.on("message", onMessage)
        subscriber
          .subscribe(replyTo)
          .then(() =>
            redis.publish(
              commandChannel(connectionId),
              JSON.stringify({ command, replyTo } satisfies CommandEnvelope)
            )
          )
          .then((listeners) => {
            if (listeners === 0) finish(null)
          })
          .catch((error: unknown) => {
            logger.error("session command publish failed", { error })
            finish(null)
          })
      })
    },
    async reply(replyTo, value) {
      await redis.publish(replyTo, JSON.stringify(value))
    },
    async close() {
      if (closed) return
      closed = true
      handlers.clear()
      await subscriber.quit()
    },
  }
}
