import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { ac, admin, operator, owner } from "@workspace/auth"
import { schema, type Database } from "@workspace/db"
import { createId, type SendInvitationEmailJob } from "@workspace/domain"
import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins/organization"
import { asc, eq } from "drizzle-orm"

export interface CreateAuthOptions {
  db: Database
  secret: string
  baseURL: string
  webAppUrl: string
  deliverInvitationEmail: (request: SendInvitationEmailJob) => Promise<void>
  onDeliveryError?: (error: unknown, request: SendInvitationEmailJob) => void
}

export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [options.webAppUrl],
    database: drizzleAdapter(options.db, {
      provider: "pg",
      usePlural: true,
    }),
    advanced: {
      database: {
        generateId: createId,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const [membership] = await options.db
              .select({ organizationId: schema.members.organizationId })
              .from(schema.members)
              .where(eq(schema.members.userId, session.userId))
              .orderBy(asc(schema.members.createdAt))
              .limit(1)
            return {
              data: {
                ...session,
                activeOrganizationId: membership?.organizationId ?? null,
              },
            }
          },
        },
      },
    },
    plugins: [
      organization({
        teams: { enabled: false },
        // Our ULID invitation ids are opaque (80-bit random), so the emailed
        // link alone proves mailbox ownership. Better Auth cannot infer that
        // from a custom generateId and would otherwise demand verified emails.
        requireEmailVerificationOnInvitation: false,
        ac,
        roles: {
          owner,
          admin,
          operator,
        },
        async sendInvitationEmail(data) {
          const request: SendInvitationEmailJob = {
            invitationId: data.id,
            email: data.email,
            inviterName: data.inviter.user.name,
            organizationName: data.organization.name,
            inviteUrl: `${options.webAppUrl}/accept-invitation/${data.id}`,
          }
          try {
            await options.deliverInvitationEmail(request)
          } catch (error) {
            options.onDeliveryError?.(error, request)
          }
        },
        schema: {
          organization: {
            additionalFields: {
              status: {
                type: "string",
                required: true,
                defaultValue: "active",
                input: false,
              },
              archivedAt: {
                type: "date",
                required: false,
                input: false,
              },
            },
          },
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
