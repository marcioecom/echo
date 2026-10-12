import { describe, expect, it } from "vitest"

import { filterInboundUpsert, phoneFromJid } from "./inbound-filter"

const direct = {
  key: {
    id: "wamid.1",
    fromMe: false,
    remoteJid: "5511888888888@s.whatsapp.net",
  },
  pushName: "Ana",
  message: { conversation: " Preciso de ajuda " },
}

describe("filterInboundUpsert", () => {
  it("keeps a direct text message", () => {
    expect(filterInboundUpsert({ type: "notify", messages: [direct] })).toEqual(
      [
        {
          action: "accept",
          externalMessageId: "wamid.1",
          senderAddress: "+5511888888888",
          senderDisplayName: "Ana",
          content: { type: "text", body: "Preciso de ajuda" },
        },
      ]
    )
  })

  it("drops history, own messages, groups, status and broadcasts", () => {
    const ignored = filterInboundUpsert({
      type: "append",
      messages: [direct],
    })
    expect(ignored).toEqual([{ action: "ignore" }])

    const cases = [
      { ...direct, key: { ...direct.key, fromMe: true } },
      {
        ...direct,
        key: { ...direct.key, remoteJid: "120363@g.us" },
      },
      {
        ...direct,
        key: { ...direct.key, remoteJid: "status@broadcast" },
      },
      {
        ...direct,
        key: { ...direct.key, remoteJid: "120363@newsletter" },
      },
      {
        ...direct,
        key: { ...direct.key, remoteJid: "123@broadcast" },
      },
      {
        ...direct,
        key: { ...direct.key, remoteJid: "999@lid", remoteJidAlt: null },
      },
    ]
    for (const message of cases) {
      expect(
        filterInboundUpsert({ type: "notify", messages: [message] })[0]
      ).toEqual({ action: "ignore" })
    }
  })

  it("marks media as unsupported and prefers the phone jid", () => {
    expect(
      filterInboundUpsert({
        type: "notify",
        messages: [
          {
            key: {
              id: "wamid.2",
              fromMe: false,
              remoteJid: "999@lid",
              remoteJidAlt: "5511777777777:12@s.whatsapp.net",
            },
            message: { imageMessage: { mimetype: "image/jpeg" } },
          },
        ],
      })
    ).toEqual([
      {
        action: "accept",
        externalMessageId: "wamid.2",
        senderAddress: "+5511777777777",
        content: { type: "unsupported", mediaKind: "image" },
      },
    ])
  })
})

describe("phoneFromJid", () => {
  it("reads the user from a device jid", () => {
    expect(phoneFromJid("5511999999999:12@s.whatsapp.net")).toBe(
      "+5511999999999"
    )
    expect(phoneFromJid("status@broadcast")).toBeNull()
  })
})
