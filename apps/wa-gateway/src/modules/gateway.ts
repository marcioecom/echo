import { UnrecoverableError, type Job } from "bullmq"
import {
  waConnectJobSchema,
  waGatewayJobNames,
  waLogoutJobSchema,
  waPairingCodeJobSchema,
  waSendJobSchema,
} from "@workspace/jobs"

import { BaileysSession } from "./session/session-runner"
import type { ConnectionRef } from "./session/session-directory"

export class SessionBusyError extends Error {
  constructor() {
    super("session_busy")
    this.name = "SessionBusyError"
  }
}

export class WaGateway {
  private session: BaileysSession | null = null
  private activeId: string | null = null

  constructor(
    private readonly deps: {
      createSession: (
        connection: ConnectionRef
      ) => Promise<BaileysSession> | BaileysSession
      findResumable: () => Promise<ConnectionRef | null>
    }
  ) {}

  async start(): Promise<void> {
    const resumable = await this.deps.findResumable()
    if (!resumable) return
    await this.connect(resumable)
  }

  async connect(connection: ConnectionRef): Promise<void> {
    if (this.session && this.activeId === connection.channelConnectionId) return
    if (this.session) throw new SessionBusyError()
    const session = await this.deps.createSession(connection)
    this.session = session
    this.activeId = connection.channelConnectionId
    void session.run().finally(() => {
      if (this.activeId === connection.channelConnectionId) {
        this.session = null
        this.activeId = null
      }
    })
  }

  async requestPairingCode(input: ConnectionRef & { phoneNumber: string }) {
    if (!this.session || this.activeId !== input.channelConnectionId) {
      await this.connect(input)
    }
    if (!this.session) throw new Error("session_unavailable")
    await this.session.requestPairingCode(input.phoneNumber)
  }

  send(input: ConnectionRef & { to: string; body: string }) {
    if (!this.session || this.activeId !== input.channelConnectionId) {
      return Promise.resolve({
        ok: false as const,
        retryable: true,
        code: "session_unavailable",
      })
    }
    return this.session.sendText(input)
  }

  async logout(connection: ConnectionRef): Promise<void> {
    if (!this.session || this.activeId !== connection.channelConnectionId)
      return
    await this.session.logout()
  }

  async stop(): Promise<void> {
    await this.session?.stop()
  }
}

export async function handleWaGatewayJob(
  gateway: WaGateway,
  job: Pick<Job, "name" | "data">
): Promise<unknown> {
  if (job.name === waGatewayJobNames.connect) {
    try {
      await gateway.connect(waConnectJobSchema.parse(job.data))
    } catch (error) {
      if (error instanceof SessionBusyError) {
        throw new UnrecoverableError("session_busy")
      }
      throw error
    }
    return
  }
  if (job.name === waGatewayJobNames.pairingCode) {
    await gateway.requestPairingCode(waPairingCodeJobSchema.parse(job.data))
    return
  }
  if (job.name === waGatewayJobNames.send) {
    const command = waSendJobSchema.parse(job.data)
    return gateway.send(command)
  }
  if (job.name === waGatewayJobNames.logout) {
    await gateway.logout(waLogoutJobSchema.parse(job.data))
    return
  }
  throw new UnrecoverableError(`Unknown wa-gateway job: ${job.name}`)
}
