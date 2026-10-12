CREATE TABLE "baileys_auth_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel_connection_id" text NOT NULL,
	"key_type" text NOT NULL,
	"key_id" text NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"auth_tag" text NOT NULL,
	"key_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "baileys_auth_keys_connection_key_unique" UNIQUE("organization_id","channel_connection_id","key_type","key_id")
);
--> statement-breakpoint
CREATE TABLE "channel_session_states" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel_connection_id" text NOT NULL,
	"state" text NOT NULL,
	"last_error" text,
	"last_connected_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"owner_pod" text,
	"reconnect_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_session_states_connection_unique" UNIQUE("organization_id","channel_connection_id"),
	CONSTRAINT "channel_session_states_state_check" CHECK ("channel_session_states"."state" in ('connecting', 'qr_pending', 'pairing_code_pending', 'connected', 'disconnected', 'logged_out', 'banned_suspected'))
);
--> statement-breakpoint
ALTER TABLE "channel_connection_provider_bindings" DROP CONSTRAINT "channel_connection_provider_bindings_provider_check";--> statement-breakpoint
ALTER TABLE "channel_connections" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD COLUMN "inbox_id" text;--> statement-breakpoint
ALTER TABLE "baileys_auth_keys" ADD CONSTRAINT "baileys_auth_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baileys_auth_keys" ADD CONSTRAINT "baileys_auth_keys_connection_fk" FOREIGN KEY ("organization_id","channel_connection_id") REFERENCES "public"."channel_connections"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_session_states" ADD CONSTRAINT "channel_session_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_session_states" ADD CONSTRAINT "channel_session_states_connection_fk" FOREIGN KEY ("organization_id","channel_connection_id") REFERENCES "public"."channel_connections"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "baileys_auth_keys_organization_id_idx" ON "baileys_auth_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_session_states_organization_id_idx" ON "channel_session_states" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "channel_connection_provider_bindings" ADD CONSTRAINT "channel_connection_provider_bindings_provider_check" CHECK ("channel_connection_provider_bindings"."provider" in ('twilio', 'baileys', 'meta_cloud'));