import cors from "@fastify/cors"
import formbody from "@fastify/formbody"
import Fastify, { type FastifyBaseLogger } from "fastify"

import { createLoggerWithContext } from "@workspace/logger"
import { env } from "./config/env"
import { database } from "./lib/db"
import { auth } from "./modules/auth/auth"
import { createChannelCredentialsCipher } from "./modules/channel-connections/adapters/channel-credentials-cipher"
import { registerTwilioWhatsAppWebhook } from "./modules/channel-connections/http/register-twilio-whatsapp-webhook"
import { createChannelConnectionsRepository } from "./modules/channel-connections/repositories/channel-connections-repository"
import { createAuthenticateTwilioWebhook } from "./modules/channel-connections/services/authenticate-twilio-webhook"
import { registerAuthRoutes } from "./plugins/auth"
import { registerHealthRoutes } from "./plugins/health"

export function createApp() {
  const logger: FastifyBaseLogger = createLoggerWithContext("api")
  const app = Fastify({ loggerInstance: logger })
  const channelConnectionsRepository = createChannelConnectionsRepository(
    database.db
  )
  const credentialsCipher = createChannelCredentialsCipher({
    encryptionKey: env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY,
    keyVersion: env.CHANNEL_CREDENTIALS_KEY_VERSION,
  })

  app.register(formbody)
  app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
  })

  registerHealthRoutes(app)
  registerAuthRoutes(app, auth)
  registerTwilioWhatsAppWebhook(app, {
    publicApiUrl: env.PUBLIC_API_URL,
    authenticate: createAuthenticateTwilioWebhook({
      repository: channelConnectionsRepository,
      credentialsCipher,
    }),
  })

  return app
}
