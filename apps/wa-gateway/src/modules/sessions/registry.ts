import type { SendResult } from "@workspace/messaging"

import { SessionBusyError, SessionUnavailableError } from "./errors"
import type { BaileysSession } from "./session"
import type { ConnectionRef } from "./types"

// One socket in this process. LEA-82 replaces the slot with Redis leases
// and a connectionId → session map. Job handlers keep calling these methods.
export class SessionRegistry {
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
    session.run().finally(() => {
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
    if (!this.session) throw new SessionUnavailableError()
    await this.session.requestPairingCode(input.phoneNumber)
  }

  async send(
    input: ConnectionRef & { to: string; body: string }
  ): Promise<SendResult> {
    if (!this.session || this.activeId !== input.channelConnectionId) {
      return {
        ok: false,
        retryable: true,
        code: "session_unavailable",
      }
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
