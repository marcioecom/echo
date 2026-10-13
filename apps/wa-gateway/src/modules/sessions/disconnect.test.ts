import { DisconnectReason } from "@whiskeysockets/baileys"
import { describe, expect, it } from "vitest"

import {
  classifyDisconnect,
  disconnectError,
  disconnectStatusCode,
} from "./disconnect"

describe("classifyDisconnect", () => {
  it("maps each Baileys close reason to one action", () => {
    expect(classifyDisconnect(DisconnectReason.restartRequired)).toBe("restart")
    expect(classifyDisconnect(DisconnectReason.loggedOut)).toBe("logged_out")
    expect(classifyDisconnect(DisconnectReason.connectionReplaced)).toBe(
      "replaced"
    )
    expect(classifyDisconnect(DisconnectReason.forbidden)).toBe("banned")
    expect(classifyDisconnect(DisconnectReason.badSession)).toBe("banned")
    expect(classifyDisconnect(DisconnectReason.connectionClosed)).toBe("retry")
    expect(classifyDisconnect(DisconnectReason.connectionLost)).toBe("retry")
    expect(classifyDisconnect(DisconnectReason.timedOut)).toBe("retry")
    expect(classifyDisconnect(DisconnectReason.unavailableService)).toBe(
      "retry"
    )
    expect(classifyDisconnect(DisconnectReason.multideviceMismatch)).toBe(
      "retry"
    )
  })
})

describe("disconnectError", () => {
  it("names the close so the dashboard can show it", () => {
    expect(disconnectError(DisconnectReason.loggedOut)).toBe("logged_out")
    expect(disconnectError(DisconnectReason.badSession)).toBe("bad_session")
    expect(disconnectError(DisconnectReason.connectionLost)).toBe(
      "connection_lost"
    )
    expect(disconnectError(DisconnectReason.timedOut)).toBe("connection_lost")
  })
})

describe("disconnectStatusCode", () => {
  it("reads a Boom status code", () => {
    expect(disconnectStatusCode({ output: { statusCode: 401 } })).toBe(401)
    expect(disconnectStatusCode(new Error("down"))).toBeUndefined()
  })
})
