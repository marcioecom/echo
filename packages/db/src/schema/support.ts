import {
	type ActorType,
	type ChannelConnectionStatus,
	type ChannelProvider,
	type ChannelSessionState,
	type ChannelType,
	createId,
	type MessageContentType,
	type MessageDirection,
	type MessageMediaDownloadStatus,
	type MessageMediaKind,
	type MessageStatus,
	type MessageTranscriptionStatus,
	type SupportConversationHandoffReason,
	type SupportConversationStatus,
} from "@workspace/domain";
import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

export const channelConnections = pgTable(
	"channel_connections",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		channelType: text("channel_type").$type<ChannelType>().notNull(),
		name: text("name").notNull(),
		displayName: text("display_name"),
		inboxId: text("inbox_id"),
		address: text("address"),
		status: text("status")
			.$type<ChannelConnectionStatus>()
			.default("pending")
			.notNull(),
		...timestamps,
	},
	(table) => [
		unique("channel_connections_organization_id_id_unique").on(
			table.organizationId,
			table.id
		),
		uniqueIndex("channel_connections_address_uidx")
			.on(table.organizationId, table.channelType, table.address)
			.where(sql`${table.address} is not null`),
		index("channel_connections_organization_id_idx").on(table.organizationId),
		check(
			"channel_connections_active_address_check",
			sql`${table.status} <> 'active' or ${table.address} is not null`
		),
	]
);

export const channelConnectionProviderBindings = pgTable(
	"channel_connection_provider_bindings",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		channelConnectionId: text("channel_connection_id").notNull(),
		provider: text("provider").$type<ChannelProvider>().notNull(),
		externalAccountId: text("external_account_id").notNull(),
		externalSenderId: text("external_sender_id").notNull(),
		routingAddress: text("routing_address").notNull(),
		credentialsCiphertext: text("credentials_ciphertext").notNull(),
		credentialsNonce: text("credentials_nonce").notNull(),
		credentialsAuthTag: text("credentials_auth_tag").notNull(),
		credentialsKeyVersion: text("credentials_key_version").notNull(),
		...timestamps,
	},
	(table) => [
		foreignKey({
			name: "channel_connection_provider_bindings_connection_fk",
			columns: [table.organizationId, table.channelConnectionId],
			foreignColumns: [
				channelConnections.organizationId,
				channelConnections.id,
			],
		}).onDelete("restrict"),
		unique("channel_connection_provider_bindings_organization_id_id_unique").on(
			table.organizationId,
			table.id
		),
		unique("channel_connection_provider_bindings_connection_unique").on(
			table.organizationId,
			table.channelConnectionId
		),
		uniqueIndex("channel_connection_provider_bindings_routing_uidx").on(
			table.provider,
			table.externalAccountId,
			table.routingAddress
		),
		index("channel_connection_provider_bindings_organization_id_idx").on(
			table.organizationId
		),
		check(
			"channel_connection_provider_bindings_provider_check",
			sql`${table.provider} in ('twilio', 'baileys', 'meta_cloud')`
		),
	]
);

export const channelSessionStates = pgTable(
	"channel_session_states",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		channelConnectionId: text("channel_connection_id").notNull(),
		state: text("state").$type<ChannelSessionState>().notNull(),
		lastError: text("last_error"),
		lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		ownerPod: text("owner_pod"),
		ownerToken: text("owner_token"),
		reconnectAttempts: integer("reconnect_attempts").default(0).notNull(),
		...timestamps,
	},
	(table) => [
		foreignKey({
			name: "channel_session_states_connection_fk",
			columns: [table.organizationId, table.channelConnectionId],
			foreignColumns: [
				channelConnections.organizationId,
				channelConnections.id,
			],
		}).onDelete("restrict"),
		unique("channel_session_states_connection_unique").on(
			table.organizationId,
			table.channelConnectionId
		),
		index("channel_session_states_organization_id_idx").on(
			table.organizationId
		),
		check(
			"channel_session_states_state_check",
			sql`${table.state} in ('connecting', 'qr_pending', 'pairing_code_pending', 'connected', 'disconnected', 'logged_out', 'banned_suspected')`
		),
	]
);

export const baileysAuthKeys = pgTable(
	"baileys_auth_keys",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		channelConnectionId: text("channel_connection_id").notNull(),
		keyType: text("key_type").notNull(),
		keyId: text("key_id").notNull(),
		ciphertext: text("ciphertext").notNull(),
		nonce: text("nonce").notNull(),
		authTag: text("auth_tag").notNull(),
		keyVersion: text("key_version").notNull(),
		...timestamps,
	},
	(table) => [
		foreignKey({
			name: "baileys_auth_keys_connection_fk",
			columns: [table.organizationId, table.channelConnectionId],
			foreignColumns: [
				channelConnections.organizationId,
				channelConnections.id,
			],
		}).onDelete("restrict"),
		unique("baileys_auth_keys_connection_key_unique").on(
			table.organizationId,
			table.channelConnectionId,
			table.keyType,
			table.keyId
		),
		index("baileys_auth_keys_organization_id_idx").on(table.organizationId),
	]
);

export const contacts = pgTable(
	"contacts",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		displayName: text("display_name"),
		...timestamps,
	},
	(table) => [
		unique("contacts_organization_id_id_unique").on(
			table.organizationId,
			table.id
		),
		index("contacts_organization_id_idx").on(table.organizationId),
	]
);

export const channelIdentities = pgTable(
	"channel_identities",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		contactId: text("contact_id").notNull(),
		channelType: text("channel_type").$type<ChannelType>().notNull(),
		address: text("address").notNull(),
		...timestamps,
	},
	(table) => [
		foreignKey({
			name: "channel_identities_contact_fk",
			columns: [table.organizationId, table.contactId],
			foreignColumns: [contacts.organizationId, contacts.id],
		}).onDelete("restrict"),
		unique("channel_identities_organization_id_id_unique").on(
			table.organizationId,
			table.id
		),
		uniqueIndex("channel_identities_address_uidx").on(
			table.organizationId,
			table.channelType,
			table.address
		),
		index("channel_identities_contact_id_idx").on(
			table.organizationId,
			table.contactId
		),
	]
);

export const supportConversations = pgTable(
	"support_conversations",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		channelIdentityId: text("channel_identity_id").notNull(),
		channelConnectionId: text("channel_connection_id").notNull(),
		status: text("status")
			.$type<SupportConversationStatus>()
			.default("open")
			.notNull(),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		handoffReason: text("handoff_reason").$type<SupportConversationHandoffReason>(),
		handoffSummary: text("handoff_summary"),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		...timestamps,
	},
	(table) => [
		foreignKey({
			name: "support_conversations_channel_identity_fk",
			columns: [table.organizationId, table.channelIdentityId],
			foreignColumns: [channelIdentities.organizationId, channelIdentities.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "support_conversations_channel_connection_fk",
			columns: [table.organizationId, table.channelConnectionId],
			foreignColumns: [
				channelConnections.organizationId,
				channelConnections.id,
			],
		}).onDelete("restrict"),
		unique("support_conversations_message_fk_unique").on(
			table.organizationId,
			table.id,
			table.channelConnectionId
		),
		uniqueIndex("support_conversations_active_uidx")
			.on(
				table.organizationId,
				table.channelIdentityId,
				table.channelConnectionId
			)
			.where(sql`${table.resolvedAt} is null`),
		index("support_conversations_inbox_idx").on(
			table.organizationId,
			table.status,
			table.lastActivityAt
		),
		check(
			"support_conversations_resolution_check",
			sql`(${table.status} = 'resolved' and ${table.resolvedAt} is not null) or (${table.status} <> 'resolved' and ${table.resolvedAt} is null)`
		),
		check(
			"support_conversations_handoff_reason_check",
			sql`${table.handoffReason} is null or ${table.handoffReason} in ('human_requested', 'low_confidence', 'unsupported_policy', 'ai_failure', 'unsupported_content', 'transcription_failed', 'operator_takeover')`
		),
		check(
			"support_conversations_handoff_summary_check",
			sql`${table.handoffSummary} is null or length(btrim(${table.handoffSummary})) > 0`
		),
	]
);

export const messages = pgTable(
	"messages",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		supportConversationId: text("support_conversation_id").notNull(),
		channelConnectionId: text("channel_connection_id").notNull(),
		direction: text("direction").$type<MessageDirection>().notNull(),
		senderType: text("sender_type").$type<ActorType>().notNull(),
		operatorUserId: text("operator_user_id").references(() => users.id, {
			onDelete: "restrict",
		}),
		contentType: text("content_type")
			.$type<MessageContentType>()
			.default("text")
			.notNull(),
		body: text("body"),
		status: text("status").$type<MessageStatus>().notNull(),
		externalMessageId: text("external_message_id"),
		replyToMessageId: text("reply_to_message_id"),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
		...timestamps,
	},
	(table) => [
		foreignKey({
			name: "messages_support_conversation_fk",
			columns: [
				table.organizationId,
				table.supportConversationId,
				table.channelConnectionId,
			],
			foreignColumns: [
				supportConversations.organizationId,
				supportConversations.id,
				supportConversations.channelConnectionId,
			],
		}).onDelete("restrict"),
		unique("messages_organization_conversation_connection_id_unique").on(
			table.organizationId,
			table.supportConversationId,
			table.channelConnectionId,
			table.id
		),
		foreignKey({
			name: "messages_reply_to_message_fk",
			columns: [
				table.organizationId,
				table.supportConversationId,
				table.channelConnectionId,
				table.replyToMessageId,
			],
			foreignColumns: [
				table.organizationId,
				table.supportConversationId,
				table.channelConnectionId,
				table.id,
			],
		}).onDelete("restrict"),
		uniqueIndex("messages_ai_reply_to_message_uidx")
			.on(table.organizationId, table.replyToMessageId)
			.where(sql`${table.senderType} = 'ai' and ${table.replyToMessageId} is not null`),
		uniqueIndex("messages_external_message_id_uidx")
			.on(
				table.organizationId,
				table.channelConnectionId,
				table.externalMessageId
			)
			.where(sql`${table.externalMessageId} is not null`),
		index("messages_conversation_timeline_idx").on(
			table.organizationId,
			table.supportConversationId,
			table.occurredAt,
			table.id
		),
		check(
			"messages_content_type_check",
			sql`${table.contentType} in ('text', 'audio', 'unsupported')`
		),
		check(
			"messages_content_body_check",
			sql`(${table.contentType} = 'text' and ${table.body} is not null and length(btrim(${table.body})) > 0) or (${table.contentType} = 'audio' and (${table.body} is null or length(btrim(${table.body})) > 0)) or (${table.contentType} = 'unsupported' and ${table.body} is null)`
		),
		check(
			"messages_audio_inbound_only_check",
			sql`${table.contentType} <> 'audio' or ${table.direction} = 'inbound'`
		),
		check(
			"messages_unsupported_inbound_check",
			sql`${table.contentType} <> 'unsupported' or (${table.direction} = 'inbound' and ${table.senderType} = 'contact' and ${table.status} = 'received')`
		),
		check(
			"messages_operator_check",
			sql`(${table.senderType} = 'operator' and ${table.operatorUserId} is not null) or (${table.senderType} <> 'operator' and ${table.operatorUserId} is null)`
		),
		check(
			"messages_direction_sender_check",
			sql`(${table.direction} = 'inbound' and ${table.senderType} = 'contact') or (${table.direction} = 'outbound' and ${table.senderType} in ('ai', 'operator', 'system'))`
		),
		check(
			"messages_ai_reply_to_message_check",
			sql`(${table.senderType} = 'ai' and ${table.direction} = 'outbound' and ${table.replyToMessageId} is not null) or (${table.senderType} <> 'ai' and ${table.replyToMessageId} is null)`
		),
	]
);

export const messageMedia = pgTable(
	"message_media",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		messageId: text("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "restrict" }),
		kind: text("kind").$type<MessageMediaKind>().notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes"),
		durationMs: integer("duration_ms"),
		downloadStatus: text("download_status")
			.$type<MessageMediaDownloadStatus>()
			.default("pending")
			.notNull(),
		objectKey: text("object_key"),
		providerRef: jsonb("provider_ref")
			.$type<Record<string, string>>()
			.default({})
			.notNull(),
		transcriptStatus: text("transcript_status")
			.$type<MessageTranscriptionStatus>()
			.default("pending")
			.notNull(),
		transcriptModel: text("transcript_model"),
		transcriptLanguage: text("transcript_language"),
		transcriptionError: text("transcription_error"),
		...timestamps,
	},
	(table) => [
		unique("message_media_organization_message_unique").on(
			table.organizationId,
			table.messageId
		),
		index("message_media_organization_download_status_idx").on(
			table.organizationId,
			table.downloadStatus
		),
		index("message_media_organization_transcript_status_idx").on(
			table.organizationId,
			table.transcriptStatus
		),
		check(
			"message_media_kind_check",
			sql`${table.kind} in ('audio')`
		),
		check(
			"message_media_download_status_check",
			sql`${table.downloadStatus} in ('pending', 'stored', 'failed')`
		),
		check(
			"message_media_transcript_status_check",
			sql`${table.transcriptStatus} in ('pending', 'transcribing', 'completed', 'failed')`
		),
		check(
			"message_media_object_key_check",
			sql`${table.downloadStatus} <> 'stored' or ${table.objectKey} is not null`
		),
		check(
			"message_media_size_check",
			sql`${table.sizeBytes} is null or ${table.sizeBytes} > 0`
		),
		check(
			"message_media_duration_check",
			sql`${table.durationMs} is null or ${table.durationMs} > 0`
		),
	]
);

export const auditEvents = pgTable(
	"audit_events",
	{
		id: text("id").primaryKey().$defaultFn(createId),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "restrict" }),
		eventType: text("event_type").notNull(),
		actorType: text("actor_type").$type<ActorType>().notNull(),
		operatorUserId: text("operator_user_id").references(() => users.id, {
			onDelete: "restrict",
		}),
		subjectType: text("subject_type").notNull(),
		subjectId: text("subject_id").notNull(),
		data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("audit_events_organization_timeline_idx").on(
			table.organizationId,
			table.occurredAt,
			table.id
		),
		index("audit_events_subject_idx").on(
			table.organizationId,
			table.subjectType,
			table.subjectId
		),
		check(
			"audit_events_operator_check",
			sql`(${table.actorType} = 'operator' and ${table.operatorUserId} is not null) or (${table.actorType} <> 'operator' and ${table.operatorUserId} is null)`
		),
	]
);
