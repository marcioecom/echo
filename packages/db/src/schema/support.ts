import {
	type ActorType,
	type ChannelConnectionStatus,
	type ChannelType,
	createId,
	type MessageDirection,
	type MessageStatus,
	type SupportConversationStatus,
} from "@workspace/domain";
import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
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
			table.id,
		),
		uniqueIndex("channel_connections_address_uidx")
			.on(table.organizationId, table.channelType, table.address)
			.where(sql`${table.address} is not null`),
		index("channel_connections_organization_id_idx").on(table.organizationId),
		check(
			"channel_connections_active_address_check",
			sql`${table.status} <> 'active' or ${table.address} is not null`,
		),
	],
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
			table.id,
		),
		index("contacts_organization_id_idx").on(table.organizationId),
	],
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
			table.id,
		),
		uniqueIndex("channel_identities_address_uidx").on(
			table.organizationId,
			table.channelType,
			table.address,
		),
		index("channel_identities_contact_id_idx").on(
			table.organizationId,
			table.contactId,
		),
	],
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
			table.channelConnectionId,
		),
		uniqueIndex("support_conversations_active_uidx")
			.on(
				table.organizationId,
				table.channelIdentityId,
				table.channelConnectionId,
			)
			.where(sql`${table.resolvedAt} is null`),
		index("support_conversations_inbox_idx").on(
			table.organizationId,
			table.status,
			table.lastActivityAt,
		),
		check(
			"support_conversations_resolution_check",
			sql`(${table.status} = 'resolved' and ${table.resolvedAt} is not null) or (${table.status} <> 'resolved' and ${table.resolvedAt} is null)`,
		),
	],
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
		body: text("body").notNull(),
		status: text("status").$type<MessageStatus>().notNull(),
		externalMessageId: text("external_message_id"),
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
		uniqueIndex("messages_external_message_id_uidx")
			.on(
				table.organizationId,
				table.channelConnectionId,
				table.externalMessageId,
			)
			.where(sql`${table.externalMessageId} is not null`),
		index("messages_conversation_timeline_idx").on(
			table.organizationId,
			table.supportConversationId,
			table.occurredAt,
			table.id,
		),
		check("messages_body_check", sql`length(btrim(${table.body})) > 0`),
		check(
			"messages_operator_check",
			sql`(${table.senderType} = 'operator' and ${table.operatorUserId} is not null) or (${table.senderType} <> 'operator' and ${table.operatorUserId} is null)`,
		),
		check(
			"messages_direction_sender_check",
			sql`(${table.direction} = 'inbound' and ${table.senderType} = 'contact') or (${table.direction} = 'outbound' and ${table.senderType} in ('ai', 'operator', 'system'))`,
		),
	],
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
			table.id,
		),
		index("audit_events_subject_idx").on(
			table.organizationId,
			table.subjectType,
			table.subjectId,
		),
		check(
			"audit_events_operator_check",
			sql`(${table.actorType} = 'operator' and ${table.operatorUserId} is not null) or (${table.actorType} <> 'operator' and ${table.operatorUserId} is null)`,
		),
	],
);
