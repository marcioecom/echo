import { DisconnectReason } from "@whiskeysockets/baileys"
import { describe, expect, it } from "vitest"

import { classifyDisconnect, disconnectStatusCode } from "./disconnect"

describe("classifyDisconnect", () => {
  it("restarts immediately after pairing and stops on logout", () => {
    expect(classifyDisconnect(DisconnectReason.restartRequired)).toBe("restart")
    expect(classifyDisconnect(DisconnectReason.loggedOut)).toBe("logged_out")
    expect(classifyDisconnect(DisconnectReason.connectionReplaced)).toBe(
      "replaced"
    )
    expect(classifyDisconnect(DisconnectReason.forbidden)).toBe("banned")
    expect(classifyDisconnect(DisconnectReason.connectionClosed)).toBe("retry")
  })
})

describe("disconnectStatusCode", () => {
  it("reads a Boom status code", () => {
    expect(disconnectStatusCode({ output: { statusCode: 401 } })).toBe(401)
    expect(disconnectStatusCode(new Error("down"))).toBeUndefined()
  })
})
