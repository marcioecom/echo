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

  it("accepts a supported audio message with duration and size", () => {
    expect(
      filterInboundUpsert({
        type: "notify",
        messages: [
          {
            key: {
              id: "wamid.audio",
              fromMe: false,
              remoteJid: "5511888888888@s.whatsapp.net",
            },
            message: {
              audioMessage: {
                mimetype: "audio/ogg; codecs=opus",
                seconds: 3.2,
                fileLength: 15_234,
              },
            },
          },
        ],
      })
    ).toEqual([
      {
        action: "accept",
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
        content: {
          type: "audio",
          media: {
            mimeType: "audio/ogg",
            sizeBytes: 15_234,
            durationMs: 3_200,
            ref: { externalMessageId: "wamid.audio" },
          },
        },
      },
    ])
  })

  it("reads protobuf-style audio integers", () => {
    const [filtered] = filterInboundUpsert({
      type: "notify",
      messages: [
        {
          key: {
            id: "wamid.audio.proto",
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          message: {
            audioMessage: {
              mimetype: "audio/mpeg",
              seconds: { toNumber: () => 4 },
              fileLength: { low: 9_000 },
            },
          },
        },
      ],
    })

    expect(filtered).toEqual({
      action: "accept",
      externalMessageId: "wamid.audio.proto",
      senderAddress: "+5511888888888",
      content: {
        type: "audio",
        media: {
          mimeType: "audio/mpeg",
          sizeBytes: 9_000,
          durationMs: 4_000,
          ref: { externalMessageId: "wamid.audio.proto" },
        },
      },
    })
  })

  it("keeps audio without a supported mime as unsupported", () => {
    const unsupported = [{ mimetype: "audio/aac", seconds: 2 }, { seconds: 2 }]

    for (const audioMessage of unsupported) {
      const [filtered] = filterInboundUpsert({
        type: "notify",
        messages: [
          {
            key: {
              id: "wamid.audio.unsupported",
              fromMe: false,
              remoteJid: "5511888888888@s.whatsapp.net",
            },
            message: { audioMessage },
          },
        ],
      })
      expect(filtered).toEqual({
        action: "accept",
        externalMessageId: "wamid.audio.unsupported",
        senderAddress: "+5511888888888",
        content: { type: "unsupported", mediaKind: "audio" },
      })
    }
  })

  it("omits non-positive audio duration and size", () => {
    const [filtered] = filterInboundUpsert({
      type: "notify",
      messages: [
        {
          key: {
            id: "wamid.audio.empty",
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          message: {
            audioMessage: {
              mimetype: "audio/ogg",
              seconds: 0,
              fileLength: -1,
            },
          },
        },
      ],
    })

    expect(filtered).toEqual({
      action: "accept",
      externalMessageId: "wamid.audio.empty",
      senderAddress: "+5511888888888",
      content: {
        type: "audio",
        media: {
          mimeType: "audio/ogg",
          ref: { externalMessageId: "wamid.audio.empty" },
        },
      },
    })
  })

  it("keeps video, document and sticker media unsupported", () => {
    const cases = [
      { message: { videoMessage: { mimetype: "video/mp4" } }, kind: "video" },
      {
        message: { documentMessage: { mimetype: "application/pdf" } },
        kind: "document",
      },
      {
        message: { stickerMessage: { mimetype: "image/webp" } },
        kind: "image",
      },
    ]

    for (const entry of cases) {
      const [filtered] = filterInboundUpsert({
        type: "notify",
        messages: [
          {
            key: {
              id: `wamid.${entry.kind}`,
              fromMe: false,
              remoteJid: "5511888888888@s.whatsapp.net",
            },
            message: entry.message,
          },
        ],
      })
      expect(filtered).toEqual({
        action: "accept",
        externalMessageId: `wamid.${entry.kind}`,
        senderAddress: "+5511888888888",
        content: { type: "unsupported", mediaKind: entry.kind },
      })
    }
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
