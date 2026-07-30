# LEA-12: Add tenant WhatsApp channel connection setup with Twilio

## Goal

Provision one Twilio subaccount-backed WhatsApp Channel Connection for an Organization, store its provider binding and credentials safely, validate Twilio webhooks against that binding, and resolve an inbound request to exactly one Organization and Channel Connection.

This is a temporary onboarding path, not the product's final connection UX. During the initial rollout, Echo staff provisions the Twilio subaccount and WhatsApp sender manually through an internal command. A future Meta Tech Provider flow will replace that command with Embedded Signup without changing the provider-neutral Channel Connection or the inbound support core.

## Decisions

1. **Twilio tenancy**: use one Twilio subaccount per Organization. The subaccount Account SID and receiving WhatsApp address form the external routing identity.
2. **Provisioning UX**: do not build a customer-facing Twilio credential form or a global staff backoffice in this slice. Add an internal provisioning command that invokes the same application service future admin surfaces can use.
3. **Authorization**: the provisioning command is an operational tool with direct runtime/database access. It is not a hidden tenant `operator` or superadmin role. The command requires an explicit Organization ID and records a system Audit Event.
4. **Provider-neutral core**: keep `channel_connections` independent of Twilio and Meta. Store replaceable provider bindings in a separate table.
5. **Credentials**: store the Twilio subaccount Auth Token with authenticated application-level encryption. Never accept secrets as command-line arguments, return them from an API, write them to logs, or include them in Audit Events.
6. **Canonical addresses**: store WhatsApp addresses as normalized E.164 values such as `+5511999999999`. Add or remove the `whatsapp:` prefix only inside provider adapters.
7. **Connection state**: a Channel Connection becomes `active` only after Echo verifies the Twilio subaccount credentials and configured sender. Failed validation leaves no new active binding and does not disable an existing working binding.
8. **Webhook routing**: use the untrusted inbound `AccountSid` and normalized `To` only to find a candidate active binding. Trust the payload only after validating `X-Twilio-Signature` with that binding's decrypted Auth Token and the configured canonical webhook URL.
9. **Audit policy**: known-Organization configuration changes and invalid signatures create immutable tenant Audit Events. Requests that cannot resolve any tenant are recorded through the structured security logger because a tenant-scoped Audit Event cannot truthfully carry an Organization ID.
10. **Future Meta migration**: a provider binding is an edge attachment to a Channel Connection. Replacing Twilio with Meta for the same WhatsApp address must not require changing Contact, Channel Identity, Support Conversation, or Message identities.

## Revised acceptance criteria

The issue's current first criterion says an owner configures Twilio credentials. That does not match the approved manual onboarding. Use this criterion instead:

- [ ] Echo staff can provision or replace an Organization's Twilio-backed WhatsApp Channel Connection through an audited internal command
- [ ] Provider credentials are validated and encrypted before the connection becomes active
- [ ] Public webhook requests from Twilio are signature-validated before processing
- [ ] The backend resolves exactly one Organization and Channel Connection from an incoming WhatsApp request
- [ ] Invalid signatures and unknown Channel Connections are rejected and audited without leaking routing or credential details

## Data model

Keep `channel_connections` as the business record:

- Organization ownership
- `channel_type = whatsapp`
- display name
- normalized E.164 address
- `pending | active | disabled` status

Add `channel_connection_provider_bindings` as the provider edge:

- ULID primary key
- `organization_id`
- `channel_connection_id`
- `provider`, initially `twilio`
- `external_account_id`, the Twilio subaccount Account SID
- `routing_address`, normalized E.164 receiving address
- encrypted credential ciphertext, nonce, authentication tag, and key version
- `active` flag or equivalent lifecycle status
- timestamps

Database constraints:

- tenant-qualified foreign key from the binding to `channel_connections`
- at most one active provider binding per Channel Connection
- globally unique active `(provider, external_account_id, routing_address)` routing key
- binding `routing_address` must match the active Channel Connection address at the application boundary
- restricted deletion so existing Conversations retain their Channel Connection
- ULIDs and plural `snake_case` names throughout

Do not add Twilio Account SID, Auth Token, Messaging Service SID, or Meta identifiers to `channel_connections`.

## Implementation sequence

### 1. Domain contracts and migration

- Extend `packages/domain/src/support.ts` with the minimal provider-binding and message-address schemas needed by API code.
- Add `channel_connection_provider_bindings` to `packages/db/src/schema/support.ts`.
- Generate and commit the Drizzle migration and metadata with `pnpm db:generate`.
- Extend `packages/db/src/schema/support.integration.test.ts` for tenant-qualified references, active-binding uniqueness, global routing uniqueness, and restricted deletion.

### 2. Credential encryption boundary

- Add `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` and `CHANNEL_CREDENTIALS_KEY_VERSION` to `apps/api/src/config/env.ts` and `apps/api/.env.example`.
- Validate the decoded key length at startup.
- Implement AES-256-GCM in `apps/api/src/modules/channel-connections/adapters/channel-credentials-cipher.ts` with a fresh nonce per write.
- Bind Organization ID, Channel Connection ID, and provider as authenticated additional data.
- Store the key version with each ciphertext so a later rotation can decrypt old records and rewrite them deliberately.
- Keep this adapter local to the API until the worker actually needs to decrypt credentials for outbound delivery.

### 3. Twilio adapter

- Add the Twilio SDK to `apps/api`.
- Implement `apps/api/src/modules/channel-connections/adapters/twilio-channel-provider.ts` behind a small interface owned by the Channel Connections module.
- Verify the subaccount credentials and confirm that the requested WhatsApp sender belongs to the configured subaccount before activation.
- Confirm the exact Twilio sender lookup against a real non-production subaccount before coding that contract; do not infer the endpoint from memory.
- Add adapter contract tests for valid credentials, invalid credentials, sender mismatch, timeout, and rate limiting.

### 4. Provisioning service and internal command

- Add `apps/api/src/modules/channel-connections/services/provision-whatsapp-channel-connection.ts`.
- Add tenant-scoped repository operations under `apps/api/src/modules/channel-connections/repositories/`.
- Add an internal CLI entrypoint under `apps/api/src/modules/channel-connections/cli/` and a package script such as `channel:provision:twilio`.
- Accept non-secret identifiers as validated CLI options. Read the Auth Token from validated stdin or a transient secret input, never from a positional argument.
- Execute this flow:
  1. Load the active Organization by explicit ULID.
  2. Normalize the requested WhatsApp address.
  3. Validate Twilio credentials and sender ownership outside the database transaction.
  4. Encrypt the Auth Token.
  5. In one transaction, create or update the Channel Connection, replace the active provider binding, activate the connection, and append a system Audit Event.
  6. Print only redacted connection identifiers and status.
- Make rerunning the command for the same Organization, subaccount, and address idempotent.

### 5. Webhook authentication and resolution

- Add `@fastify/formbody` because Twilio sends form-encoded webhook payloads.
- Add a fixed public route such as `POST /webhooks/twilio/whatsapp/inbound` under the Channel Connections HTTP boundary.
- Add `PUBLIC_API_URL` to API configuration and use it to construct the exact canonical callback URL used in Twilio signature verification. Do not derive the signed URL from untrusted `Host` or forwarding headers.
- Keep the route public and outside Better Auth membership guards.
- Resolve a candidate binding by normalized `AccountSid + To`, decrypt its Auth Token, verify `X-Twilio-Signature`, and only then pass a normalized command onward.
- Return one generic rejection response for missing candidates, mismatched account/address, and invalid signatures so the endpoint does not become a routing oracle.
- In LEA-12, stop after authenticated resolution and expose the normalized result to the LEA-13 ingestion service. Do not persist Contacts, Conversations, or Messages here.

### 6. Optional connected-state UI

- Do not build a Twilio setup form.
- If product visibility is needed before LEA-14, add only a read-only Channels settings view showing address and connection status. It must not expose provider credentials or provider implementation details to ordinary operators.
- This read-only view is not required to prove LEA-12's backend acceptance criteria.

## Main files

Expected additions or changes:

- `packages/domain/src/support.ts`
- `packages/db/src/schema/support.ts`
- `packages/db/src/schema/support.integration.test.ts`
- `packages/db/migrations/*`
- `apps/api/package.json`
- `apps/api/.env.example`
- `apps/api/src/config/env.ts`
- `apps/api/src/app.ts`
- `apps/api/src/modules/channel-connections/schemas.ts`
- `apps/api/src/modules/channel-connections/adapters/channel-credentials-cipher.ts`
- `apps/api/src/modules/channel-connections/adapters/twilio-channel-provider.ts`
- `apps/api/src/modules/channel-connections/repositories/channel-connections-repository.ts`
- `apps/api/src/modules/channel-connections/services/provision-whatsapp-channel-connection.ts`
- `apps/api/src/modules/channel-connections/http/register-twilio-whatsapp-webhook.ts`
- `apps/api/src/modules/channel-connections/cli/provision-twilio-whatsapp.ts`

## Verification

### Unit and contract tests

- E.164 and `whatsapp:` boundary normalization
- encryption round trip, random nonce, tamper rejection, wrong key, and wrong authenticated context
- redaction of credentials from results, errors, logs, and audit metadata
- Twilio signature validation against Twilio's real signing functions
- canonical URL changes, payload tampering, missing signature, and wrong token all fail validation

### Database integration tests

- provider binding cannot cross Organizations
- only one active binding exists per Channel Connection
- a provider routing key cannot resolve to two Organizations
- replacement preserves the provider-neutral Channel Connection
- credentials are not present as plaintext in persisted columns
- configuration and Audit Event commit atomically

### API and CLI integration tests

- provisioning creates an active connection and immutable Audit Event
- rerunning identical input is idempotent
- invalid credentials create no active binding
- replacing credentials changes ciphertext without exposing the secret
- valid signed webhook resolves the expected Organization and Channel Connection
- invalid signature and unknown routing create no support-core records
- archived Organizations cannot be provisioned

### Live smoke check

- Use one dedicated non-production Twilio subaccount and sender.
- Provision it through the command.
- Configure the fixed callback URL.
- Send one signed test request and one real WhatsApp message.
- Keep this check opt-in and outside normal CI.

## Acceptance mapping

- **Manual tenant connection setup**: internal provisioning command, provider validation, encrypted binding, and transactional audit.
- **Signature validation**: canonical public URL plus per-binding Twilio Auth Token validation.
- **Tenant resolution**: globally unique active provider routing key maps to one provider-neutral Channel Connection and Organization.
- **Reject and audit failures**: tenant Audit Events for known bindings and structured security audit logs before tenant resolution.

## Out of scope

- Buying phone numbers automatically
- Automating Twilio subaccount or WhatsApp sender approval
- Customer-facing Twilio credential forms
- A global Echo staff authorization model or backoffice UI
- Meta Business verification and Embedded Signup
- Contact, Channel Identity, Conversation, or Message ingestion
- Outbound WhatsApp delivery
- Credential key rotation execution; only versioned storage is included
